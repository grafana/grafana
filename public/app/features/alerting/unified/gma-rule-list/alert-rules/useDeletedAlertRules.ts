import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useState } from 'react';

import { type AlertRule, useListAlertRuleQuery } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

const PAGE_SIZE = 40;
const TRASH_LABEL_SELECTOR = 'grafana.app/get-trash=true';

export interface UseDeletedAlertRulesResult {
  items: AlertRule[];
  hasMore: boolean;
  isLoading: boolean;
  isFetchingMore: boolean;
  error: unknown;
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

  // Always fetch the first page
  const firstPage = useListAlertRuleQuery({
    labelSelector: TRASH_LABEL_SELECTOR,
    limit: PAGE_SIZE,
  });

  // Fetch subsequent pages only when triggered
  const nextPage = useListAlertRuleQuery(
    fetchingNextPage && continueToken
      ? { labelSelector: TRASH_LABEL_SELECTOR, limit: PAGE_SIZE, continue: continueToken }
      : skipToken
  );

  // Handle next page result
  if (nextPage.isSuccess && !nextPage.isFetching && fetchingNextPage) {
    const newItems = nextPage.data?.items ?? [];
    setExtraItems((prev) => [...prev, ...newItems]);
    const nextToken = nextPage.data?.metadata?.continue;
    if (!nextToken) {
      setServerDone(true);
    } else {
      setContinueToken(nextToken);
    }
    setFetchingNextPage(false);
  }

  const firstItems = firstPage.data?.items ?? [];
  const allItems = [...firstItems, ...extraItems];
  const firstContinueToken = firstPage.data?.metadata?.continue;

  const items = allItems.slice(0, revealed);
  const hasMore = revealed < allItems.length || (!serverDone && firstContinueToken != null && !fetchingNextPage);

  const loadMore = useCallback(() => {
    if (revealed < allItems.length) {
      setRevealed((r) => r + PAGE_SIZE);
    } else if (!serverDone && firstContinueToken && !fetchingNextPage) {
      setContinueToken(firstContinueToken);
      setFetchingNextPage(true);
      setRevealed((r) => r + PAGE_SIZE);
    }
  }, [revealed, allItems.length, serverDone, firstContinueToken, fetchingNextPage]);

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
    loadMore,
    refetch,
  };
}
