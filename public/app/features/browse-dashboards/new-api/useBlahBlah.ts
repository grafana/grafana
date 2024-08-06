/* eslint-disable no-console */
import { BaseQueryFn, QueryDefinition, QueryResultSelectorResult } from '@reduxjs/toolkit/query';
import { useCallback, useMemo } from 'react';

import { useMultipleQueries } from './useMultipleQueries';

import { newBrowseDashboardsAPI } from '.';

interface NewBrowseItemDashboard {
  type: 'dashboard';
  title: string;
  uid: string;
  parentUid?: string;
}

interface NewBrowseItemFolder {
  type: 'folder';
  title: string;
  uid: string;
  parentUid?: string;
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

  // type FolderPage = (typeof folderPages)[number];
  // type DashPage = (typeof folderPages)[number];

  // const pagesByFolderUid = useMemo(() => {
  //   const byFolderUid: Record<string, Array<FolderPage | DashPage>> = {};

  //   for (const page of folderPages) {
  //     const parentUid = page.originalArgs?.parentUid ?? 'general';
  //     byFolderUid[parentUid] = byFolderUid[parentUid] ?? [];
  //     byFolderUid[parentUid].push(page);
  //   }

  //   for (const page of dashPages) {
  //     const parentUid = (page.originalArgs?.folderUiDs ?? ['general'])[0];

  //     byFolderUid[parentUid] = byFolderUid[parentUid] ?? [];
  //     byFolderUid[parentUid].push(page);
  //   }

  //   return byFolderUid;
  // }, [folderPages, dashPages]);

  const isLoading = folderPages.some((page) => page.isLoading) || dashPages.some((page) => page.isLoading);

  const allItems = useMemo(() => {
    const allFolders: NewBrowseItemFolder[] = folderPages
      .flatMap((page) => page.data ?? [])
      .map((v) => ({ type: 'folder' as const, uid: v.uid!, title: v.title!, parentUid: v.parentUid }));

    const allDashboards: NewBrowseItemDashboard[] = dashPages
      .flatMap((page) => page.data ?? [])
      .map((v) => ({ type: 'dashboard' as const, uid: v.uid!, title: v.title!, parentUid: v.folderUid }));

    return [...allFolders, ...allDashboards];
  }, [folderPages, dashPages]);

  const lastLoadedFolderPage = folderPages.findLast(isFullfilled);
  const lastLoadedDashPage = dashPages.findLast(isFullfilled);

  const lastFolderPageIsEmpty = lastLoadedFolderPage ? lastLoadedFolderPage.data?.length === 0 : false;
  const lastDashPageIsEmpty = lastLoadedDashPage ? lastLoadedDashPage.data?.length === 0 : false;

  const requestNextPage = useCallback(() => {
    if (!lastFolderPageIsEmpty) {
      const lastPageNumber = lastLoadedFolderPage?.originalArgs?.page ?? 0;
      requestFolderPage({ page: lastPageNumber + 1, limit: PAGE_SIZE });
    } else if (!lastDashPageIsEmpty) {
      const lastPageNumber = lastLoadedDashPage?.originalArgs?.page ?? 0;
      requestDashPage({ page: lastPageNumber + 1, limit: PAGE_SIZE, type: 'dash-db', folderUiDs: ['general'] });
    } else {
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
