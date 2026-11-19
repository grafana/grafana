import { useCallback, useState } from 'react';

import { type RecordingRule, generatedAPI } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

const PAGE_SIZE = DEFAULT_PER_PAGE_PAGINATION;
const TRASH_LABEL_SELECTOR = 'grafana.app/get-trash=true';

const trashAPI = generatedAPI.injectEndpoints({
  endpoints: (build) => ({
    listDeletedRecordingRules: build.infiniteQuery<
      { items: RecordingRule[]; continueToken?: string },
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
          generatedAPI.endpoints.listRecordingRule.initiate(
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
      providesTags: ['RecordingRule'],
    }),
  }),
});

const { useListDeletedRecordingRulesInfiniteQuery } = trashAPI;

export interface UseDeletedRecordingRulesResult {
  items: RecordingRule[];
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
 * Fetches soft-deleted recording rules and normalizes pagination.
 * Legacy storage ignores `limit` and returns all tombstones — we normalize
 * by revealing items in 40-row chunks from a local buffer.
 */
export function useDeletedRecordingRules(): UseDeletedRecordingRulesResult {
  const [revealed, setRevealed] = useState(PAGE_SIZE);

  const { data, isLoading, isFetching, error, fetchNextPage, hasNextPage, refetch } =
    useListDeletedRecordingRulesInfiniteQuery(undefined, { refetchOnMountOrArgChange: true });

  const allItems = data?.pages.flatMap((page) => page.items) ?? [];
  const items = allItems.slice(0, revealed);
  const isFetchingMore = isFetching && !isLoading;
  const hasMore =
    revealed < allItems.length || Boolean(hasNextPage) || isFetchingMore || Boolean(error && allItems.length > 0);

  const loadMore = useCallback(() => {
    if (revealed < allItems.length) {
      setRevealed((r) => r + PAGE_SIZE);
    } else if (!isFetching && (hasNextPage || error)) {
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
