/* eslint-disable no-console */
import { BaseQueryFn, QueryDefinition, QueryResultSelectorResult } from '@reduxjs/toolkit/query';
import { useCallback, useMemo } from 'react';

import { useMultipleQueries } from './useMultipleQueries';

import { newBrowseDashboardsAPI } from '.';

interface NewBrowseItemDashboard {
  type: 'dashboard';
  title: string;
  uid: string;
}

interface NewBrowseItemFolder {
  type: 'folder';
  title: string;
  uid: string;
}

export type NewBrowseItem = NewBrowseItemDashboard | NewBrowseItemFolder;

interface UseNewAPIBlahBlahPayload {
  items: NewBrowseItem[];
  isLoading: boolean;
  hasNextPage: boolean;
  requestNextPage: () => void;
}

const isFullfilled = (
  page: QueryResultSelectorResult<
    QueryDefinition<unknown, BaseQueryFn<unknown, unknown, unknown, {}, {}>, string, unknown, string>
  >
) => page.status === 'fulfilled';

const PAGE_SIZE = 50;

export function useNewAPIBlahBlah(): UseNewAPIBlahBlahPayload {
  const [folderPages, requestFolderPage] = useMultipleQueries(newBrowseDashboardsAPI.endpoints.getFolders);
  const [dashPages, requestDashPage] = useMultipleQueries(newBrowseDashboardsAPI.endpoints.search);

  const isLoading = folderPages.some((page) => page.isLoading) || dashPages.some((page) => page.isLoading);

  const allItems = useMemo(() => {
    const allFolders: NewBrowseItemFolder[] = folderPages
      .flatMap((page) => page.data ?? [])
      .map((v) => ({ type: 'folder' as const, uid: v.uid!, title: v.title! }));

    const allDashboards: NewBrowseItemDashboard[] = dashPages
      .flatMap((page) => page.data ?? [])
      .map((v) => ({ type: 'dashboard' as const, uid: v.uid!, title: v.title! }));

    return [...allFolders, ...allDashboards];
  }, [folderPages, dashPages]);

  const lastLoadedFolderPage = folderPages.findLast(isFullfilled);
  const lastLoadedDashPage = dashPages.findLast(isFullfilled);

  const lastFolderPageIsEmpty = lastLoadedFolderPage ? lastLoadedFolderPage.data?.length === 0 : false;
  const lastDashPageIsEmpty = lastLoadedDashPage ? lastLoadedDashPage.data?.length === 0 : false;

  const requestNextPage = useCallback(() => {
    if (!lastFolderPageIsEmpty) {
      const lastPageNumber = lastLoadedFolderPage?.originalArgs?.page ?? 0;
      console.log('requesting folder page', lastPageNumber + 1);
      requestFolderPage({ page: lastPageNumber + 1, limit: PAGE_SIZE });
    } else if (!lastDashPageIsEmpty) {
      // The last folder page must be empty, so request dashboards
      const lastPageNumber = lastLoadedDashPage?.originalArgs?.page ?? 0;
      console.log('requesting dash page', lastPageNumber + 1);
      requestDashPage({ page: lastPageNumber + 1, limit: PAGE_SIZE, type: 'dash-db', folderUiDs: ['general'] });
    } else {
      // Both are empty - this request should never have been made!
      console.warn('Both folder and dash pages are empty');
    }
  }, [
    lastFolderPageIsEmpty,
    lastDashPageIsEmpty,
    lastLoadedFolderPage?.originalArgs?.page,
    requestFolderPage,
    lastLoadedDashPage?.originalArgs?.page,
    requestDashPage,
  ]);

  return {
    items: allItems,
    isLoading: isLoading,
    hasNextPage: !lastDashPageIsEmpty,
    requestNextPage: requestNextPage,
  };
}
