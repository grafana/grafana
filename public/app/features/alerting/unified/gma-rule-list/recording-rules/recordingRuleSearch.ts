import { useMemo } from 'react';
import * as z from 'zod';

import { generatedAPI } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type ResultTotal } from '../rule-row/ResultCount';
import { type PagedFailure } from '../shared/PagedFailureAlert';

import { type RecordingRuleSearchHit, recordingRuleSearchHitSchema } from './recordingRuleSearchHit';
import { buildRecordingRuleSearchQuery } from './recordingRuleSearchQuery';

interface RecordingRuleSearchPage {
  hits: RecordingRuleSearchHit[];
  continueToken?: string;
  total?: ResultTotal;
}

// Only what the list reads. The total is optional to show, so a bad one hides the count instead of failing the page.
const recordingRuleSearchResponseSchema = z.object({
  items: z.array(recordingRuleSearchHitSchema),
  metadata: z.object({
    continue: z.string().optional(),
    totalHits: z.number().optional().catch(undefined),
    totalHitsRelation: z.string().optional().catch(undefined),
  }),
});

type RecordingRuleSearchResponse = z.infer<typeof recordingRuleSearchResponseSchema>;

/** Infinite query; the generated search is a POST mutation with no tags or page state. */
const recordingRuleSearchAPI = generatedAPI.injectEndpoints({
  endpoints: (build) => ({
    searchRecordingRules: build.infiniteQuery<RecordingRuleSearchPage, void, string | undefined>({
      infiniteQueryOptions: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.continueToken || undefined,
      },
      // Results are a view of the current page only: leaving it drops them, and coming back searches again.
      keepUnusedDataFor: 0,
      query: ({ pageParam }) => ({
        url: '/searchRecordingRules',
        method: 'POST',
        body: buildRecordingRuleSearchQuery(pageParam),
      }),
      rawResponseSchema: recordingRuleSearchResponseSchema,
      // A response that fails the schema becomes a query error, so the page shows it with Retry.
      catchSchemaFailure: (error) => ({ message: error.message }),
      transformResponse: (response: RecordingRuleSearchResponse): RecordingRuleSearchPage => ({
        hits: response.items,
        continueToken: response.metadata.continue,
        total: toResultTotal(response.metadata),
      }),
      providesTags: ['RecordingRule'],
    }),
  }),
});

const { useSearchRecordingRulesInfiniteQuery } = recordingRuleSearchAPI;

export function useRecordingRuleSearch() {
  const query = useSearchRecordingRulesInfiniteQuery();
  const { currentData, isError, error, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = query;
  // Missing from the result type of a query that has not started.
  const isFetchNextPageError = 'isFetchNextPageError' in query && query.isFetchNextPageError;

  // currentData, not data: while the arguments change, data still holds the previous arguments' pages.
  const pages = currentData?.pages;
  const items = useMemo(() => pages?.flatMap((page) => page.hits) ?? [], [pages]);
  const hasLoaded = pages !== undefined;
  const failure: PagedFailure | undefined =
    hasLoaded && isError ? { kind: isFetchNextPageError ? 'load-more' : 'refresh', error } : undefined;

  return {
    items,
    isLoading: !hasLoaded && !isError,
    // A failed first page replaces the list; a later failure keeps the loaded rows and shows `failure` below them.
    error: !hasLoaded && isError ? error : undefined,
    failure,
    hasMore: hasNextPage,
    isLoadingMore: isFetchingNextPage,
    loadMore: () => {
      void fetchNextPage();
    },
    // Refetching reloads every loaded page with fresh continuation tokens, so it also recovers from an expired one.
    retry: () => {
      void refetch();
    },
    // Only the first page's total counts; later pages repeat it and the count never drives paging.
    total: pages?.[0]?.total,
  };
}

function toResultTotal({
  totalHits,
  totalHitsRelation,
}: RecordingRuleSearchResponse['metadata']): ResultTotal | undefined {
  if (totalHits === undefined) {
    return undefined;
  }
  return { count: totalHits, isLowerBound: totalHitsRelation === 'lte' };
}
