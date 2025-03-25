import { createSelector } from '@reduxjs/toolkit';
import { QueryDefinition, BaseQueryFn, QueryActionCreatorResult } from '@reduxjs/toolkit/query';
import { RequestOptions } from 'http';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { ListFolderQueryArgs, browseDashboardsAPI } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { PAGE_SIZE } from 'app/features/browse-dashboards/api/services';
import { getPaginationPlaceholders } from 'app/features/browse-dashboards/state/utils';
import { DashboardViewItemWithUIItems, DashboardsTreeItem } from 'app/features/browse-dashboards/types';
import { RootState } from 'app/store/configureStore';
import { FolderListItemDTO, PermissionLevelString } from 'app/types';
import { useDispatch, useSelector } from 'app/types/store';

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

const listAllFoldersSelector = createSelector(
  [(state: RootState) => state, (state: RootState, requests: ListFoldersRequest[]) => requests],
  (state: RootState, requests: ListFoldersRequest[]) => {
    const seenRequests = new Set<string>();

    const rootPages: ListFoldersQuery[] = [];
    const pagesByParent: Record<string, ListFoldersQuery[]> = {};
    let isLoading = false;

    for (const req of requests) {
      if (seenRequests.has(req.requestId)) {
        continue;
      }

      const page = browseDashboardsAPI.endpoints.listFolders.select({
        parentUid: req.arg.parentUid,
        page: req.arg.page,
        limit: req.arg.limit,
        permission: req.arg.permission,
      })(state);

      if (page.status === 'pending') {
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
  }
);

/**
 * Returns whether the set of pages are 'fully loaded', and the last page number
 */
function getPagesLoadStatus(pages: ListFoldersQuery[]): [boolean, number | undefined] {
  const lastPage = pages.at(-1);
  const lastPageNumber = lastPage?.originalArgs?.page;

  if (!lastPage?.data) {
    // If there's no pages yet, or the last page is still loading
    return [false, lastPageNumber];
  } else {
    return [lastPage.data.length < lastPage.originalArgs.limit, lastPageNumber];
  }
}

/**
 * Returns a loaded folder hierarchy as a flat list and a function to load more pages.
 */
export function useFoldersQuery(
  isBrowsing: boolean,
  openFolders: Record<string, boolean>,
  permission?: PermissionLevelString
) {
  const dispatch = useDispatch();

  // Keep a list of all requests so we can
  //   a) unsubscribe from them when the component is unmounted
  //   b) use them to select the responses out of the state
  const requestsRef = useRef<ListFoldersRequest[]>([]);

  const state = useSelector((rootState: RootState) => {
    return listAllFoldersSelector(rootState, requestsRef.current);
  });

  // Loads the next page of folders for the given parent UID by inspecting the
  // state to determine what the next page is
  const requestNextPage = useCallback(
    (parentUid: string | undefined) => {
      const pages = parentUid ? state.pagesByParent[parentUid] : state.rootPages;
      const [fullyLoaded, pageNumber] = getPagesLoadStatus(pages ?? []);
      if (fullyLoaded) {
        return;
      }

      const args = { parentUid, page: (pageNumber ?? 0) + 1, limit: PAGE_SIZE, permission };
      const promise = dispatch(browseDashboardsAPI.endpoints.listFolders.initiate(args));

      // It's important that we create a new array so we can correctly memoize with it
      requestsRef.current = requestsRef.current.concat([promise]);
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

    const rootFlatTree = createFlatList(undefined, state.rootPages, 1);
    rootFlatTree.unshift(ROOT_FOLDER_ITEM);

    return rootFlatTree;
  }, [state, isBrowsing, openFolders]);

  return {
    items: treeList,
    isLoading: state.isLoading,
    requestNextPage,
  };
}

export const ROOT_FOLDER_ITEM = {
  isOpen: true,
  level: 0,
  item: {
    kind: 'folder' as const,
    title: 'Dashboards',
    uid: '',
  },
};
