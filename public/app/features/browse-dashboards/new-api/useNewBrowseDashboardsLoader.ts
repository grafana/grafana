/* eslint-disable no-console */
import { useCallback, useMemo } from 'react';

import { config } from '@grafana/runtime';

import { NewBrowseItem, NewBrowseItemDashboard, NewBrowseItemFolder, OpenFolders } from '../newTypes';

import { useMultipleQueries } from './useMultipleQueries';

import { newBrowseDashboardsAPI } from '.';

interface UseNewBrowseDashboardsLoaderPayload {
  items: NewBrowseItem[];
  isLoading: boolean;
  requestNextPage: (parentUID?: string) => void;
}

const PAGE_SIZE = 50;

// TODO: this is a temporary type, we should use the real one
type TempFolderPage = ReturnType<ReturnType<typeof newBrowseDashboardsAPI.endpoints.getFolders.select>>;
type TempDashPage = ReturnType<ReturnType<typeof newBrowseDashboardsAPI.endpoints.search.select>>;

interface PageInfo<Page> {
  isLoading: boolean;
  pagesByParentUID: Record<string, Page[]>;
}

function useFoldersQuery(/* rootFolderUID */) {
  const [folderPages, requestFolderPage] = useMultipleQueries(newBrowseDashboardsAPI.endpoints.getFolders);

  const pageInfo = useMemo(() => {
    const pagesByParentUID: Record<string, TempFolderPage[]> = {};
    let isLoading = false;

    for (const page of folderPages) {
      if (page.isLoading) {
        isLoading = true;
      }

      const parentUID = page.originalArgs?.parentUid ?? config.rootFolderUID;
      if (!parentUID) {
        console.warn(
          "Folder page skipped because it doesn't have parent UID, probably because config.rootFolderUID is undefined",
          page
        );
        continue;
      }

      pagesByParentUID[parentUID] ??= [];
      pagesByParentUID[parentUID].push(page);
    }

    const payload: PageInfo<TempFolderPage> = {
      isLoading,
      pagesByParentUID,
    };

    return payload;
  }, [folderPages]);

  const wrappedRequestFolderPage: typeof requestFolderPage = useCallback(
    (...args) => {
      console.log('%crequestFolderPage', 'color: #2ecc71', ...args);
      return requestFolderPage(...args);
    },
    [requestFolderPage]
  );

  return [pageInfo, wrappedRequestFolderPage] as const;
}

function useDashboardsQuery(/* rootFolderUID */) {
  const [dashPages, requestDashPage] = useMultipleQueries(newBrowseDashboardsAPI.endpoints.search);

  const pageInfo = useMemo(() => {
    const pagesByParentUID: Record<string, TempDashPage[]> = {};
    let isLoading = false;

    for (const page of dashPages) {
      if (page.isLoading) {
        isLoading = true;
      }

      const parentUID = page.originalArgs?.folderUiDs?.[0] ?? config.rootFolderUID;
      if (!parentUID) {
        console.warn(
          "Dashboard page skipped because it doesn't have parent UID, probably because config.rootFolderUID is undefined",
          page
        );
        continue;
      }

      pagesByParentUID[parentUID] ??= [];
      pagesByParentUID[parentUID].push(page);
    }

    const payload: PageInfo<TempFolderPage> = {
      isLoading,
      pagesByParentUID,
    };

    return payload;
  }, [dashPages]);

  const wrappedRequestDashPage: typeof requestDashPage = useCallback(
    (...args) => {
      console.log('%crequestDashPage', 'color: #2ecc71', ...args);
      return requestDashPage(...args);
    },
    [requestDashPage]
  );

  return [pageInfo, wrappedRequestDashPage] as const;
}

const _REQUEST_LIMIT = 500;
let _requestCount = 0;
let _loggedLimited = false;

const PLACEHOLDER_COUNT = 3;

export function useNewBrowseDashboardsLoader(
  rootFolderUID: string | undefined,
  openFolders: OpenFolders
): UseNewBrowseDashboardsLoaderPayload {
  const [foldersState, requestFolderPage] = useFoldersQuery();
  const [dashState, requestDashPage] = useDashboardsQuery();

  const isLoading = foldersState.isLoading || dashState.isLoading;

  const allItems = useMemo(() => {
    if (!config.rootFolderUID) {
      console.warn('config.rootFolderUID is not defined');
      return [];
    }

    console.log('%c-------- tree creation --------', 'color: #1abc9c');

    let createTreeCalls = 0;
    function createTree(parentUID: string | undefined, level: number): NewBrowseItem[] {
      console.groupCollapsed('%ccreateTree', 'color: #1abc9c', { parentUID, level });

      if (createTreeCalls === 0) {
        console.log('openFolders', openFolders);
        console.log('foldersState', foldersState);
        console.log('dashState', dashState);
      }

      if (createTreeCalls++ > 5) {
        console.warn('createTree limit reached');
        console.groupEnd();
        return [];
      }

      if (!config.rootFolderUID) {
        throw new Error('config.rootFolderUID is not defined');
      }

      const folderPages = foldersState.pagesByParentUID[parentUID ?? config.rootFolderUID] ?? [];
      const dashPages = dashState.pagesByParentUID[parentUID ?? config.rootFolderUID] ?? [];

      const tree: NewBrowseItem[] = [];

      let fakeUidCounter = 0;

      for (const folderPage of folderPages) {
        console.log('looking at folderPage', folderPage.originalArgs);

        const pageItems = folderPage.data ?? [];

        for (const folderItem of pageItems) {
          // TODO: improve the type of FolderSearchHit to say that UID is always there
          const uid = folderItem.uid!;

          const isOpen = openFolders[uid] ?? false;
          const browseItem: NewBrowseItemFolder = {
            type: 'folder',
            uid: uid,
            level,
            isOpen: isOpen,
            item: folderItem,
          };

          tree.push(browseItem);

          if (isOpen) {
            const childTree = createTree(folderItem.uid, level + 1);
            tree.push(...childTree);
          }
        }
      }

      for (const dashPage of dashPages) {
        const pageItems = dashPage.data ?? [];

        for (const item of pageItems) {
          const browseItem: NewBrowseItemDashboard = {
            type: 'dashboard',
            uid: item.uid!,
            title: item.title!,
            level,
          };

          tree.push(browseItem);
        }
      }

      const lastFolderPage = folderPages.at(-1);
      if (!lastFolderPage?.data || lastFolderPage.data.length !== 0) {
        console.log('Adding loading placeholders for folders');
        for (let i = 0; i < PLACEHOLDER_COUNT; i++) {
          tree.push({
            type: 'loading-placeholder',
            uid: `loading-placeholder-${level}-${fakeUidCounter++}-folder-${parentUID}`,
            parentUid: parentUID,
            level,
          });
        }
      } else {
        const lastDashPage = dashPages.at(-1);
        if (!lastDashPage || !lastDashPage.data || lastDashPage.data.length !== 0) {
          console.log('Adding loading placeholders for dashboards');
          for (let i = 0; i < PLACEHOLDER_COUNT; i++) {
            tree.push({
              type: 'loading-placeholder',
              uid: `loading-placeholder-${level}-${fakeUidCounter++}-dashboard-${parentUID}`,
              parentUid: parentUID,
              level,
            });
          }
        }
      }

      console.groupEnd();

      return tree;
    }

    const tree = createTree(rootFolderUID, 0);

    return tree;
  }, [rootFolderUID, foldersState, dashState, openFolders]);

  const requestNextPage = useCallback(
    (folderUID: string | undefined) => {
      if (_requestCount++ > _REQUEST_LIMIT) {
        if (!_loggedLimited) {
          console.warn('Request limit reached');
          _loggedLimited = true;
        }
        return;
      }

      console.group('%crequestNextPage for folderUID', 'color: #3498db', folderUID);

      if (!config.rootFolderUID) {
        console.warn('config.rootFolderUID is not defined');
        return;
      }

      const folderPages = foldersState.pagesByParentUID[folderUID ?? config.rootFolderUID] ?? [];

      const [foldersFullyLoaded, nextFolderPageNumber] = getPaginationStatus(folderPages);
      if (!foldersFullyLoaded) {
        requestFolderPage({ page: nextFolderPageNumber, limit: PAGE_SIZE, parentUid: folderUID });
      } else {
        const dashPages = dashState.pagesByParentUID[folderUID ?? config.rootFolderUID] ?? [];
        const [dashboardsFullyLoaded, nextDashboardsPageNumber] = getPaginationStatus(dashPages);

        if (!dashboardsFullyLoaded) {
          requestDashPage({
            page: nextDashboardsPageNumber,
            limit: PAGE_SIZE,
            type: 'dash-db',
            folderUiDs: [folderUID ?? 'general'],
          });
        } else {
          console.log('Unexpected state - both folders and dashboards are fully loaded');
        }
      }

      console.groupEnd();
    },
    [dashState.pagesByParentUID, foldersState.pagesByParentUID, requestDashPage, requestFolderPage]
  );

  return {
    items: allItems,
    isLoading: isLoading,
    requestNextPage: requestNextPage,
  };
}

function getPaginationStatus(
  pages: Array<TempFolderPage | TempDashPage>
): [IsFullyLoaded: boolean, NextPageNumber: number] {
  const lastPage = pages.at(-1);
  const pageNumber = lastPage?.originalArgs?.page;

  if (!lastPage) {
    return [false, 1];
  }

  if (pageNumber === undefined) {
    throw new Error("Page number is not defined, can't determine next page");
  }

  if (lastPage.status !== 'fulfilled') {
    throw new Error('last page is not fulfilled, can not determine if fully loaded');
  }

  // if the last page has zero items, consider it fully loaded
  if (lastPage.data.length === 0) {
    // fully loaded
    return [true, -1];
  }

  // more to load
  return [false, pageNumber + 1];
}
