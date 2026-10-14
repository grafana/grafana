import { useMemo, useState } from 'react';

import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

import { type InfiniteQueryResult, type PagedFailure, retryPagedQuery, toPagedFailure } from '../shared/pagedQuery';

export interface UseDeletedRulesResult<T> {
  /** The rules revealed so far, in the order the API returned them (newest deletion first). */
  rows: T[];
  isLoading: boolean;
  /** The first request failed, so there is nothing to show. */
  error?: unknown;
  /** A request failed while rows are already shown; they stay visible. */
  failure?: PagedFailure;
  hasMore: boolean;
  isLoadingMore: boolean;
  /** How many rules the API returned for the first request, which can exceed the rows revealed. */
  returnedCount?: number;
  loadMore: () => void;
  /** Starts again from the first chunk. */
  refresh: () => void;
  retry: () => void;
}

/**
 * Reveals a trash collection in chunks. The legacy trash ignores `limit` and returns every
 * tombstone in one response, while Unified Storage pages with continuation tokens, so each
 * response is cut into chunks locally and a request is only made once all of them are shown.
 * Neither path is detected: an oversized response and a continuation token both just mean more
 * rows to reveal. The order is never changed.
 */
export function useDeletedRules<T>(
  query: InfiniteQueryResult<{ items: T[] }>,
  restartFromFirstPage: () => void
): UseDeletedRulesResult<T> {
  const [revealed, setRevealed] = useState(DEFAULT_PER_PAGE_PAGINATION);
  const pages = query.currentData?.pages;
  const hasLoaded = pages !== undefined;
  const loaded = useMemo(() => pages?.flatMap((page) => page.items) ?? [], [pages]);
  const rows = useMemo(() => loaded.slice(0, revealed), [loaded, revealed]);

  const restart = () => {
    restartFromFirstPage();
    setRevealed(DEFAULT_PER_PAGE_PAGINATION);
  };

  return {
    rows,
    isLoading: !hasLoaded && !query.isError,
    error: !hasLoaded && query.isError ? query.error : undefined,
    failure: hasLoaded ? toPagedFailure(query) : undefined,
    hasMore: loaded.length > revealed || query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    returnedCount: pages?.[0]?.items.length,
    loadMore: () => {
      setRevealed(revealed + DEFAULT_PER_PAGE_PAGINATION);
      // Rows already fetched are shown before asking the server for more.
      if (loaded.length <= revealed) {
        void query.fetchNextPage();
      }
    },
    refresh: () => {
      restart();
      void query.refetch();
    },
    retry: () => retryPagedQuery(query, restart),
  };
}
