import { useState } from 'react';

import { useDispatch } from 'app/types/store';

import { type PagedFailure, keepFirstPage, retryPagedQuery, toPagedFailure } from '../shared/pagedQuery';

import { type FolderHit, folderSearchAPI, useSearchRuleFoldersInfiniteQuery } from './folderSearch';

export interface UseFolderPagesResult {
  folders: FolderHit[];
  isLoading: boolean;
  error?: unknown;
  failure?: PagedFailure;
  isLoadingPage: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
  next: () => void;
  previous: () => void;
  retry: () => void;
}

/** The query keeps every visited page (tokens in memory), so going back is free and refetches do not move the user. */
export function useFolderPages(folderUids: string[]): UseFolderPagesResult {
  const dispatch = useDispatch();
  const filterKey = JSON.stringify(folderUids);
  const [position, setPosition] = useState({ filterKey, pageIndex: 0 });
  if (position.filterKey !== filterKey) {
    setPosition({ filterKey, pageIndex: 0 });
  }

  const query = useSearchRuleFoldersInfiniteQuery({ folderUids });
  const pages = query.currentData?.pages;
  const hasLoaded = pages !== undefined;
  // The wanted page can be ahead of the loaded ones while the next page is fetching or has failed;
  // the last loaded page stays on screen until it arrives.
  const shownIndex = pages ? Math.min(position.pageIndex, pages.length - 1) : 0;

  const restartFromFirstPage = () => {
    dispatch(folderSearchAPI.util.updateQueryData('searchRuleFolders', { folderUids }, keepFirstPage));
    setPosition({ filterKey, pageIndex: 0 });
  };

  return {
    folders: pages?.[shownIndex]?.folders ?? [],
    isLoading: !hasLoaded && !query.isError,
    error: !hasLoaded && query.isError ? query.error : undefined,
    failure: hasLoaded ? toPagedFailure(query) : undefined,
    isLoadingPage: query.isFetchingNextPage,
    hasNext: hasLoaded && (shownIndex < pages.length - 1 || query.hasNextPage),
    hasPrevious: shownIndex > 0,
    next: () => {
      setPosition({ filterKey, pageIndex: shownIndex + 1 });
      if (pages && shownIndex === pages.length - 1) {
        void query.fetchNextPage();
      }
    },
    previous: () => setPosition({ filterKey, pageIndex: Math.max(shownIndex - 1, 0) }),
    retry: () => retryPagedQuery(query, restartFromFirstPage),
  };
}
