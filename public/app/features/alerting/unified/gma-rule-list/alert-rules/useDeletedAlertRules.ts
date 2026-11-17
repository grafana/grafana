import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useState } from 'react';

import { type AlertRule, useListAlertRuleQuery } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

const PAGE_SIZE = DEFAULT_PER_PAGE_PAGINATION;
const TRASH_LABEL_SELECTOR = 'grafana.app/get-trash=true';

export interface UseDeletedAlertRulesResult {
  items: AlertRule[];
  hasMore: boolean;
  isLoading: boolean;
  isFetchingMore: boolean;
  error: unknown;
  /** Total items returned by the API (all pages combined) — use for analytics, not display. */
  totalFromApi: number | undefined;
  loadMore: () => void;
  refetch: () => void;
}

/**
 * Fetches soft-deleted alert rules and normalizes pagination.
 * Legacy storage ignores `limit` and returns all tombstones — we normalize
 * by revealing items in 40-row chunks from a local buffer.
 */
export function useDeletedAlertRules(): UseDeletedAlertRulesResult {
  // How many items to expose (always a multiple of PAGE_SIZE)
  const [revealed, setRevealed] = useState(PAGE_SIZE);
  // Continue token for fetching the next server page (triggers re-query)
  const [continueToken, setContinueToken] = useState<string | undefined>(undefined);
  // Items from additional server pages (beyond first)
  const [extraItems, setExtraItems] = useState<AlertRule[]>([]);
  // Whether all server pages have been fetched
  const [serverDone, setServerDone] = useState(false);
  // Whether a next-page fetch is in progress
  const [fetchingNextPage, setFetchingNextPage] = useState(false);

  // Always fetch the first page; refetchOnMountOrArgChange ensures fresh data
  // when the user navigates back after a restore (cache invalidation alone is
  // not enough because RTK Query won't auto-refetch stale data on remount).
  const firstPage = useListAlertRuleQuery(
    { labelSelector: TRASH_LABEL_SELECTOR, limit: PAGE_SIZE },
    { refetchOnMountOrArgChange: true }
  );

  // Fetch subsequent pages only when triggered
  const nextPage = useListAlertRuleQuery(
    fetchingNextPage && continueToken
      ? { labelSelector: TRASH_LABEL_SELECTOR, limit: PAGE_SIZE, continue: continueToken }
      : skipToken
  );

  // Handle next page result
  if (!nextPage.isFetching && fetchingNextPage) {
    if (nextPage.isSuccess) {
      const newItems = nextPage.data?.items ?? [];
      setExtraItems((prev) => [...prev, ...newItems]);
      const latestToken = nextPage.data?.metadata?.continue;
      if (!latestToken) {
        setServerDone(true);
      } else {
        setContinueToken(latestToken);
      }
    }
    // Clear fetchingNextPage on both success and error so Load more stays
    // visible and the user can retry after a failed page fetch.
    setFetchingNextPage(false);
  }

  const firstItems = firstPage.data?.items ?? [];
  const allItems = [...firstItems, ...extraItems];
  const firstContinueToken = firstPage.data?.metadata?.continue;

  const items = allItems.slice(0, revealed);
  // After extra pages are fetched, continueToken holds the latest token; fall
  // back to firstContinueToken for the very first next-page request.
  const nextToken = continueToken ?? firstContinueToken;
  const hasMore = revealed < allItems.length || (!serverDone && nextToken != null && !fetchingNextPage);

  const loadMore = useCallback(() => {
    if (revealed < allItems.length) {
      setRevealed((r) => r + PAGE_SIZE);
    } else if (!serverDone && nextToken && !fetchingNextPage) {
      setContinueToken(nextToken);
      setFetchingNextPage(true);
      setRevealed((r) => r + PAGE_SIZE);
    }
  }, [revealed, allItems.length, serverDone, nextToken, fetchingNextPage]);

  const refetch = useCallback(() => {
    setExtraItems([]);
    setRevealed(PAGE_SIZE);
    setContinueToken(undefined);
    setServerDone(false);
    setFetchingNextPage(false);
    firstPage.refetch();
  }, [firstPage]);

  return {
    items,
    hasMore,
    isLoading: firstPage.isLoading,
    isFetchingMore: fetchingNextPage,
    error: firstPage.error ?? nextPage.error,
    // Total items seen across all fetched pages — undefined until first page loads.
    totalFromApi: firstPage.data ? allItems.length : undefined,
    loadMore,
    refetch,
  };
}
