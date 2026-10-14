import { useMemo } from 'react';

import { isFetchError } from '@grafana/runtime';

/** The part of an RTK Query infinite query hook result that paging UI reads. */
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

/** A request that failed while data was already loaded, which stays on screen. */
export interface PagedFailure {
  /** The next page failed, or refetching the pages already loaded did. */
  kind: 'load-more' | 'refresh';
  error: unknown;
}

export interface PagedResult<T> {
  /** Every loaded page's items, in the order the server returned them. */
  items: T[];
  /** The first page is still loading and nothing has loaded yet. */
  isLoading: boolean;
  /** The first request failed, so there is nothing to show. */
  error?: unknown;
  failure?: PagedFailure;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
  retry: () => void;
}

/**
 * Adapts an infinite query result to what a "Load more" list renders. `restartFromFirstPage` drops
 * every page but the first from the cache, for the case where a continuation token can no longer
 * be used.
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

/**
 * Repeats the request that failed. A failed continuation request is repeated with the same token,
 * unless the server rejected the token: it can never succeed, so the chain starts again from the
 * first page instead.
 */
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

/** Cache recipe for `updateQueryData` that keeps only the first page of an infinite query. */
export function keepFirstPage(draft: { pages: unknown[]; pageParams: unknown[] }) {
  draft.pages.splice(1);
  draft.pageParams.splice(1);
}

// 400 and 422 for a malformed or unknown token, 410 for one that expired.
const REJECTED_CONTINUATION_STATUSES = [400, 410, 422];

export function isRejectedContinuation(error: unknown): boolean {
  return isFetchError(error) && REJECTED_CONTINUATION_STATUSES.includes(error.status);
}
