import { createSelector } from '@reduxjs/toolkit';
import { QueryStatus } from '@reduxjs/toolkit/query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { folderAPIv1beta1 } from 'app/api/clients/folder/v1beta1';
import { DashboardViewItemWithUIItems, DashboardsTreeItem } from 'app/features/browse-dashboards/types';
import { useDispatch, useSelector } from 'app/types/store';

import { AnnoKeyManagerKind, ManagerKind } from '../../../features/apiserver/types';
import { PAGE_SIZE } from '../../../features/browse-dashboards/api/services';
import { getPaginationPlaceholders } from '../../../features/browse-dashboards/state/utils';

import { ROOT_FOLDER_ITEM } from './utils';

type GetFolderChildrenQuery = ReturnType<ReturnType<typeof folderAPIv1beta1.endpoints.getFolderChildren.select>>;
type GetFolderChildrenRequest = {
  unsubscribe: () => void;
};

const rootFolderToken = 'general';
const collator = new Intl.Collator();

/**
 * Returns a loaded folder hierarchy as a flat list and a function to load folders.
 * This version uses the getFolderChildren API from the folder v1beta1 API. Compared to legacy API, the v1beta1 API
 * does not have pagination at the moment.
 */
export function useFoldersQueryAppPlatform(isBrowsing: boolean, openFolders: Record<string, boolean>) {
  const dispatch = useDispatch();

  // Keep a list of all request subscriptions so we can unsubscribe from them when the component is unmounted
  const requestsRef = useRef<GetFolderChildrenRequest[]>([]);

  // Keep a list of selectors for dynamic state selection
  const [selectors, setSelectors] = useState<
    Array<ReturnType<typeof folderAPIv1beta1.endpoints.getFolderChildren.select>>
  >([]);

  // This is an aggregated dynamic selector of all the selectors for all the request issued while loading the folder
  // tree and returns the whole tree that was loaded so far.
  const listAllFoldersSelector = useMemo(() => {
    return createSelector(selectors, (...responses) => {
      // Returns loading true if any of the responses is still loading
      let isLoading = false;

      const responseByParent: Record<string, GetFolderChildrenQuery> = {};

      for (const response of responses) {
        if (response.status === QueryStatus.pending) {
          isLoading = true;
        }

        const parentName = response.originalArgs?.name;
        if (parentName) {
          responseByParent[parentName] = response;
        }
      }

      return {
        isLoading,
        responseByParent,
      };
    });
  }, [selectors]);

  const state = useSelector(listAllFoldersSelector);

  // Loads folders for the given parent UID
  const requestNextPage = useCallback(
    (parentUid: string | undefined) => {
      const finalParentUid = parentUid ?? rootFolderToken;
      const response = state.responseByParent[finalParentUid];
      const isLoading = response?.status === QueryStatus.pending;

      // If already loading, don't request again
      if (isLoading) {
        return;
      }

      const args = { name: finalParentUid };

      // Make a request
      const subscription = dispatch(folderAPIv1beta1.endpoints.getFolderChildren.initiate(args));

      // Add selector for the response to the list so we can then have an aggregated selector for all the folders
      const selector = folderAPIv1beta1.endpoints.getFolderChildren.select(args);
      setSelectors((selectors) => selectors.concat(selector));

      // the subscriptions are saved in a ref so they can be unsubscribed on unmount
      requestsRef.current = requestsRef.current.concat([subscription]);
    },
    [state, dispatch]
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
      response: GetFolderChildrenQuery | undefined,
      level: number
    ): Array<DashboardsTreeItem<DashboardViewItemWithUIItems>> {
      let folders = response?.data?.items ? [...response.data.items] : [];
      folders.sort((a, b) => collator.compare(a.spec.title, b.spec.title));

      const list = folders.flatMap((item) => {
        const name = item.metadata.name!;
        const folderIsOpen = openFolders[name];
        const flatItem: DashboardsTreeItem<DashboardViewItemWithUIItems> = {
          isOpen: Boolean(folderIsOpen),
          level: level,
          item: {
            kind: 'folder' as const,
            title: item.spec.title,
            // We use resource name as UID because well, not sure what metadata.uid would be used for now as you cannot
            // query by it.
            uid: name,
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            managedBy: item.metadata?.annotations?.[AnnoKeyManagerKind] as ManagerKind | undefined,
          },
        };

        const childResponse = folderIsOpen && state.responseByParent[name];
        if (childResponse) {
          const childFlatItems = createFlatList(name, childResponse, level + 1);
          return [flatItem, ...childFlatItems];
        }

        return flatItem;
      });

      if (!response) {
        // The pagination placeholders are what actually triggers the call to the next page. So if there is no response,
        // meaning to request for some children, we add these placeholders, and they will trigger the load.
        list.push(...getPaginationPlaceholders(PAGE_SIZE, parentUid, level));
      }
      return list;
    }

    const rootFlatTree = createFlatList(rootFolderToken, state.responseByParent[rootFolderToken], 1);
    rootFlatTree.unshift(ROOT_FOLDER_ITEM);

    return rootFlatTree;
  }, [state, isBrowsing, openFolders]);

  return {
    items: treeList,
    isLoading: state.isLoading,
    requestNextPage,
  };
}
