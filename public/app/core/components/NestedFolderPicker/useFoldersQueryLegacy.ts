import { createSelector } from '@reduxjs/toolkit';
import { QueryDefinition, BaseQueryFn, QueryActionCreatorResult } from '@reduxjs/toolkit/query';
import { RequestOptions } from 'http';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ListFolderQueryArgs, browseDashboardsAPI } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { PAGE_SIZE } from 'app/features/browse-dashboards/api/services';
import { getPaginationPlaceholders } from 'app/features/browse-dashboards/state/utils';
import { DashboardViewItemWithUIItems, DashboardsTreeItem } from 'app/features/browse-dashboards/types';
import { PermissionLevelString } from 'app/types/acl';
import { FolderListItemDTO } from 'app/types/folders';
import { useDispatch, useSelector } from 'app/types/store';

import { getRootFolderItem } from './utils';

type ListFoldersQuery = ReturnType<ReturnType<typeof browseDashboardsAPI.endpoints.listFolders.select>>;
type ListFoldersRequest = QueryActionCreatorResult<
  QueryDefinition<
    ListFolderQueryArgs,
    BaseQueryFn<RequestOptions>,
    'getFolder',
    FolderListItemDTO[],
    'browseDashboardsAPI'
  >
>;

const PENDING_STATUS = 'pending';

/**
 * Returns whether the set of pages are 'fully loaded', the last page number, and if the last page is currently loading
 */
function getPagesLoadStatus(pages: ListFoldersQuery[]): [boolean, number | undefined, boolean] {
  const lastPage = pages.at(-1);
  const lastPageNumber = lastPage?.originalArgs?.page;
  const lastPageLoading = lastPage?.status === PENDING_STATUS;

  if (!lastPage?.data) {
    // If there's no pages yet, or the last page is still loading
    return [false, lastPageNumber, lastPageLoading];
  } else {
    return [lastPage.data.length < lastPage.originalArgs.limit, lastPageNumber, lastPageLoading];
  }
}

/**
 * Returns a loaded folder hierarchy as a flat list and a function to load more pages.
 */
export function useFoldersQueryLegacy(
  isBrowsing: boolean,
  openFolders: Record<string, boolean>,
  permission?: PermissionLevelString,
  /* rootFolderUID: configure which folder to start browsing from */
  rootFolderUID?: string
) {
  const dispatch = useDispatch();

  // Keep a list of all request subscriptions so we can unsubscribe from them when the component is unmounted
  const requestsRef = useRef<ListFoldersRequest[]>([]);

  // Keep a list of selectors for dynamic state selection
  const [selectors, setSelectors] = useState<
    Array<ReturnType<typeof browseDashboardsAPI.endpoints.listFolders.select>>
  >([]);

  const listAllFoldersSelector = useMemo(() => {
    return createSelector(selectors, (...pages) => {
      let isLoading = false;
      const rootPages: ListFoldersQuery[] = [];
      const pagesByParent: Record<string, ListFoldersQuery[]> = {};

      for (const page of pages) {
        if (page.status === PENDING_STATUS) {
          isLoading = true;
        }

        const parentUid = page.originalArgs?.parentUid;
        if (parentUid) {
          if (!pagesByParent[parentUid]) {
            pagesByParent[parentUid] = [];
          }

          pagesByParent[parentUid].push(page);
        } else {
          rootPages.push(page);
        }
      }

      return {
        isLoading,
        rootPages,
        pagesByParent,
      };
    });
  }, [selectors]);

  const state = useSelector(listAllFoldersSelector);

  // Loads the next page of folders for the given parent UID by inspecting the
  // state to determine what the next page is
  const requestNextPage = useCallback(
    (parentUid: string | undefined) => {
      const pages = parentUid ? state.pagesByParent[parentUid] : state.rootPages;
      const [fullyLoaded, pageNumber, lastPageLoading] = getPagesLoadStatus(pages ?? []);

      // If fully loaded or the last page is still loading, don't request a new page
      if (fullyLoaded || lastPageLoading) {
        return;
      }

      const args = { parentUid, page: (pageNumber ?? 0) + 1, limit: PAGE_SIZE, permission };
      const subscription = dispatch(browseDashboardsAPI.endpoints.listFolders.initiate(args));

      const selector = browseDashboardsAPI.endpoints.listFolders.select({
        parentUid: subscription.arg.parentUid,
        page: subscription.arg.page,
        limit: subscription.arg.limit,
        permission: subscription.arg.permission,
      });

      setSelectors((pages) => pages.concat(selector));

      // the subscriptions are saved in a ref so they can be unsubscribed on unmount
      requestsRef.current = requestsRef.current.concat([subscription]);
    },
    [state, dispatch, permission]
  );

  // Unsubscribe from all requests when the component is unmounted
  useEffect(() => {
    return () => {
      for (const req of requestsRef.current) {
        req.unsubscribe();
      }
    };
  }, []);

  // Convert the individual responses into a flat list of folders, with level indicating
  // the depth in the hierarchy.
  const treeList = useMemo(() => {
    if (!isBrowsing) {
      return [];
    }

    function createFlatList(
      parentUid: string | undefined,
      pages: ListFoldersQuery[],
      level: number
    ): Array<DashboardsTreeItem<DashboardViewItemWithUIItems>> {
      const flatList = pages.flatMap((page) => {
        const pageItems = page.data ?? [];

        return pageItems.flatMap((item) => {
          const folderIsOpen = openFolders[item.uid];
          const flatItem: DashboardsTreeItem<DashboardViewItemWithUIItems> = {
            isOpen: Boolean(folderIsOpen),
            level: level,
            item: {
              kind: 'folder' as const,
              title: item.title,
              uid: item.uid,
              managedBy: item.managedBy,
            },
          };

          const childPages = folderIsOpen && state.pagesByParent[item.uid];
          if (childPages) {
            const childFlatItems = createFlatList(item.uid, childPages, level + 1);
            return [flatItem, ...childFlatItems];
          }

          return flatItem;
        });
      });

      const [fullyLoaded] = getPagesLoadStatus(pages);
      if (!fullyLoaded) {
        flatList.push(...getPaginationPlaceholders(PAGE_SIZE, parentUid, level));
      }

      return flatList;
    }

    const startingParentUid = rootFolderUID ?? undefined;
    const startingPages = rootFolderUID ? state.pagesByParent[rootFolderUID] : state.rootPages;

    const rootFlatTree = createFlatList(startingParentUid, startingPages ?? [], 1);
    rootFlatTree.unshift(getRootFolderItem());

    return rootFlatTree;
  }, [state, isBrowsing, openFolders, rootFolderUID]);

  return {
    items: treeList,
    isLoading: state.isLoading,
    requestNextPage,
  };
}
