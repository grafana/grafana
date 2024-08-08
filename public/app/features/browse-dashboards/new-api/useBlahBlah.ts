/* eslint-disable no-console */
import { BaseQueryFn, QueryDefinition, QueryResultSelectorResult } from '@reduxjs/toolkit/query';
import { useCallback, useMemo } from 'react';

import { NewBrowseItem, NewBrowseItemDashboard, NewBrowseItemFolder, OpenFolders } from '../newTypes';

import { useMultipleQueries } from './useMultipleQueries';

import { FolderSearchHit, Hit, newBrowseDashboardsAPI } from '.';

interface UseNewAPIBlahBlahPayload {
  items: NewBrowseItem[];
  isLoading: boolean;
  hasNextPage: boolean;
  requestNextPage: (parentUID?: string) => void;
}

const isFullfilled = (
  page: QueryResultSelectorResult<
    QueryDefinition<unknown, BaseQueryFn<unknown, unknown, unknown, {}, {}>, string, unknown, string>
  >
) => page.status === 'fulfilled';

const PAGE_SIZE = 50;

function mapFolderToBrowseItem(folder: FolderSearchHit): NewBrowseItemFolder {
  return {
    type: 'folder',
    uid: folder.uid!,
    title: folder.title!,
    parentUid: folder.parentUid,
  };
}

function mapDashToBrowseItem(dash: Hit): NewBrowseItemDashboard {
  return {
    type: 'dashboard',
    uid: dash.uid!,
    title: dash.title!,
    parentUid: dash.folderUid,
  };
}

export function useNewAPIBlahBlah(openFolders: OpenFolders): UseNewAPIBlahBlahPayload {
  const [folderPages, requestFolderPage] = useMultipleQueries(newBrowseDashboardsAPI.endpoints.getFolders);
  const [dashPages, requestDashPage] = useMultipleQueries(newBrowseDashboardsAPI.endpoints.search);

  const isLoading = folderPages.some((page) => page.isLoading) || dashPages.some((page) => page.isLoading);

  const lastLoadedFolderPage = folderPages.findLast(isFullfilled);
  const lastLoadedDashPage = dashPages.findLast(isFullfilled);

  const lastFolderPageIsEmpty = lastLoadedFolderPage ? lastLoadedFolderPage.data?.length === 0 : false;
  const lastDashPageIsEmpty = lastLoadedDashPage ? lastLoadedDashPage.data?.length === 0 : false;

  /* this is where we would make a flatTree */
  const allItems = useMemo(() => {
    let fakeUidCounter = 0;

    const flatTree: NewBrowseItem[] = [];
    let foldersFullyLoaded = false;
    let dashboardsFullyLoaded = false;

    for (let pageIndex = 0; pageIndex < folderPages.length; pageIndex++) {
      const page = folderPages[pageIndex];
      const isLast = pageIndex === folderPages.length - 1;

      const browseItems: NewBrowseItemFolder[] = page.data?.map(mapFolderToBrowseItem) ?? [];
      flatTree.push(...browseItems);

      if (isLast && page.data?.length === 0) {
        foldersFullyLoaded = true;
      }
    }

    for (let pageIndex = 0; pageIndex < dashPages.length; pageIndex++) {
      const page = dashPages[pageIndex];
      const isLast = pageIndex === dashPages.length - 1;

      const browseItems = page.data?.map(mapDashToBrowseItem) ?? [];
      flatTree.push(...browseItems);

      if (isLast && page.data?.length === 0) {
        dashboardsFullyLoaded = true;
      }
    }

    console.log('useNewAPIBlahBlah', {
      foldersFullyLoaded,
      dashboardsFullyLoaded,
    });

    if (!foldersFullyLoaded || !dashboardsFullyLoaded) {
      for (let i = 0; i < 10; i++) {
        flatTree.push({ type: 'loading-placeholder', uid: `fake-uid-${fakeUidCounter++}` });
      }
    }

    return flatTree;
  }, [folderPages, dashPages]);

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
