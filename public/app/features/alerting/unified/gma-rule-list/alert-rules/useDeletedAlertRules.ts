import { useCallback, useState } from 'react';

import { type AlertRule, generatedAPI } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

const PAGE_SIZE = DEFAULT_PER_PAGE_PAGINATION;
const TRASH_LABEL_SELECTOR = 'grafana.app/get-trash=true';

/**
 * Infinite query for the trash list. The continue token from each page becomes
 * the pageParam for the next, matching the pattern used by searchRecordingRules.
 */
const trashAPI = generatedAPI.injectEndpoints({
  endpoints: (build) => ({
    listDeletedAlertRules: build.infiniteQuery<
      { items: AlertRule[]; continueToken?: string },
      void,
      string | undefined
    >({
      infiniteQueryOptions: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.continueToken || undefined,
      },
      keepUnusedDataFor: 0,
      queryFn: async ({ pageParam }, { dispatch }) => {
        const response = await dispatch(
          generatedAPI.endpoints.listAlertRule.initiate(
            { labelSelector: TRASH_LABEL_SELECTOR, limit: PAGE_SIZE, continue: pageParam },
            { subscribe: false, forceRefetch: true }
          )
        );
        if (response.error) {
          return { error: response.error };
        }
        return {
          data: {
            items: response.data?.items ?? [],
            continueToken: response.data?.metadata?.continue,
          },
        };
      },
      providesTags: ['AlertRule'],
    }),
  }),
});

const { useListDeletedAlertRulesInfiniteQuery } = trashAPI;

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
  const [revealed, setRevealed] = useState(PAGE_SIZE);

  const { data, isLoading, isFetching, error, fetchNextPage, hasNextPage, refetch } =
    useListDeletedAlertRulesInfiniteQuery(undefined, { refetchOnMountOrArgChange: true });

  const allItems = data?.pages.flatMap((page) => page.items) ?? [];
  const items = allItems.slice(0, revealed);
  const isFetchingMore = isFetching && !isLoading;
  // Keep hasMore true while fetching more or when a next-page fetch failed so
  // the Load more button stays visible (showing spinner or allowing retry).
  const hasMore =
    revealed < allItems.length || Boolean(hasNextPage) || isFetchingMore || Boolean(error && allItems.length > 0);

  const loadMore = useCallback(() => {
    if (revealed < allItems.length) {
      setRevealed((r) => r + PAGE_SIZE);
    } else if (!isFetching && (hasNextPage || error)) {
      // Allow retry when a previous next-page fetch failed (error is set but
      // hasNextPage may be false since the error response had no continueToken).
      void fetchNextPage();
      setRevealed((r) => r + PAGE_SIZE);
    }
  }, [revealed, allItems.length, hasNextPage, error, isFetching, fetchNextPage]);

  const handleRefetch = useCallback(() => {
    setRevealed(PAGE_SIZE);
    void refetch();
  }, [refetch]);

  return {
    items,
    hasMore,
    isLoading,
    isFetchingMore,
    error,
    totalFromApi: data ? allItems.length : undefined,
    loadMore,
    refetch: handleRefetch,
  };
}
