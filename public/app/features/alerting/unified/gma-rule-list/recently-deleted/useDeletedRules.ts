import { useMemo, useState } from 'react';

import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

import { type PagedFailure } from '../shared/PagedFailureAlert';
import { type InfiniteQueryResult, retryPagedQuery, toPagedFailure } from '../shared/pagedQuery';

export interface UseDeletedRulesResult<T> {
  rows: T[];
  isLoading: boolean;
  error?: unknown;
  failure?: PagedFailure;
  hasMore: boolean;
  isLoadingMore: boolean;
  /** Count from the first response, which can exceed the rows revealed. */
  returnedCount?: number;
  loadMore: () => void;
  retry: () => void;
}

/** Legacy trash ignores `limit`; both backends are revealed in local chunks, fetching more only once all are shown. */
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
      if (loaded.length <= revealed) {
        void query.fetchNextPage();
      }
    },
    retry: () => retryPagedQuery(query, restart),
  };
}
