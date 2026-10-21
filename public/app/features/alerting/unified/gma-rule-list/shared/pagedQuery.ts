import { useMemo } from 'react';

import { isFetchError } from '@grafana/runtime';

export interface InfiniteQueryResult<TPage> {
  currentData?: { pages: TPage[] };
  isError: boolean;
  error?: unknown;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  /** Missing from the type of a query that has not started, so it reads as false there. */
  isFetchNextPageError?: boolean;
  fetchNextPage: () => unknown;
  refetch: () => unknown;
}

export interface PagedFailure {
  kind: 'load-more' | 'refresh';
  error: unknown;
}

export interface PagedResult<T> {
  items: T[];
  isLoading: boolean;
  error?: unknown;
  failure?: PagedFailure;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
  retry: () => void;
}

/**
 * Derives what a paged list renders from an RTK Query infinite query, which keeps the loaded pages; this
 * hook keeps no state. It splits a failed first page (`error`) from a failed later request (`failure`),
 * and routes Retry. `restartFromFirstPage` drops later pages, for when a continuation token can no
 * longer be used.
 */
export function usePagedResult<TPage, T>(
  query: InfiniteQueryResult<TPage>,
  getItems: (page: TPage) => T[],
  restartFromFirstPage: () => void
): PagedResult<T> {
  // currentData, not data: while the arguments change, data still holds the previous arguments' pages.
  const pages = query.currentData?.pages;
  const items = useMemo(() => pages?.flatMap(getItems) ?? [], [pages, getItems]);
  const hasLoaded = pages !== undefined;

  return {
    items,
    isLoading: !hasLoaded && !query.isError,
    error: !hasLoaded && query.isError ? query.error : undefined,
    failure: hasLoaded ? toPagedFailure(query) : undefined,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => {
      void query.fetchNextPage();
    },
    retry: () => retryPagedQuery(query, restartFromFirstPage),
  };
}

export function toPagedFailure(
  query: Pick<InfiniteQueryResult<unknown>, 'isError' | 'error' | 'isFetchNextPageError'>
): PagedFailure | undefined {
  if (!query.isError) {
    return undefined;
  }
  return { kind: query.isFetchNextPageError ? 'load-more' : 'refresh', error: query.error };
}

/** Retries with the same token, unless the server rejected it: then restarts from the first page. */
export function retryPagedQuery(
  query: Pick<InfiniteQueryResult<unknown>, 'isFetchNextPageError' | 'error' | 'fetchNextPage' | 'refetch'>,
  restartFromFirstPage: () => void
) {
  if (!query.isFetchNextPageError) {
    void query.refetch();
    return;
  }
  if (isRejectedContinuation(query.error)) {
    restartFromFirstPage();
    void query.refetch();
    return;
  }
  void query.fetchNextPage();
}

export function keepFirstPage(draft: { pages: unknown[]; pageParams: unknown[] }) {
  draft.pages.splice(1);
  draft.pageParams.splice(1);
}

// 400 and 422 for a malformed or unknown token, 410 for one that expired.
const REJECTED_CONTINUATION_STATUSES = [400, 410, 422];

export function isRejectedContinuation(error: unknown): boolean {
  return isFetchError(error) && REJECTED_CONTINUATION_STATUSES.includes(error.status);
}
