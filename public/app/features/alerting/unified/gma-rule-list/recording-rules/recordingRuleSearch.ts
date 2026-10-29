import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';
import * as z from 'zod';

import { generatedAPI } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type ResultTotal } from '../rule-row/ResultCount';
import { type FilterIssue } from '../rule-search/parser';
import { getRejectionIssues } from '../rule-search/searchRejection';
import { type RuleSearchApiArgs } from '../rule-search/sharedRuleFilter';
import { type RuleListMode } from '../rule-search/useRuleListSearchState';
import { useRuleSearchApiArgs } from '../rule-search/useRuleSearchApiArgs';
import { type PagedFailure } from '../shared/PagedFailureAlert';

import { type RecordingRuleFilter } from './recordingRuleFilters';
import { type RecordingRuleSearchHit, recordingRuleSearchHitSchema } from './recordingRuleSearchHit';
import { buildRecordingRuleLeaves, buildRecordingRuleSearchQuery } from './recordingRuleSearchQuery';

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

/**
 * Infinite query keyed by filter, so a new filter starts again from the first page. The generated
 * search is a POST mutation with no tags or page state.
 */
const recordingRuleSearchAPI = generatedAPI.injectEndpoints({
  endpoints: (build) => ({
    searchRecordingRules: build.infiniteQuery<
      RecordingRuleSearchPage,
      RuleSearchApiArgs<RecordingRuleFilter>,
      string | undefined
    >({
      infiniteQueryOptions: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.continueToken || undefined,
      },
      // Results are a view of the current page only: leaving it drops them, and coming back searches again.
      keepUnusedDataFor: 0,
      query: ({ queryArg, pageParam }) => ({
        url: '/searchRecordingRules',
        method: 'POST',
        body: buildRecordingRuleSearchQuery(queryArg, pageParam),
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

export function useRecordingRuleSearch(filter: RecordingRuleFilter, { inFolderUid }: { inFolderUid?: string } = {}) {
  const { search, isLookingUp, lookupError, retryLookup, noMatchingFolder } = useRuleSearchApiArgs(filter, {
    inFolderUid,
  });
  const query = useSearchRecordingRulesInfiniteQuery(search ?? skipToken);
  const { currentData, isError, error, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = query;
  // Missing from the result type of a query that has not started.
  const isFetchNextPageError = 'isFetchNextPageError' in query && query.isFetchNextPageError;

  // currentData, not data: while the arguments change, data still holds the previous arguments' pages.
  const pages = currentData?.pages;
  const items = useMemo(() => pages?.flatMap((page) => page.hits) ?? [], [pages]);
  const hasLoaded = pages !== undefined;
  const failure: PagedFailure | undefined =
    hasLoaded && isError ? { kind: isFetchNextPageError ? 'load-more' : 'refresh', error } : undefined;
  const firstPageError = !hasLoaded && isError ? error : undefined;

  return {
    items,
    noMatchingFolder,
    isLoading: isLookingUp || (search !== undefined && !hasLoaded && !isError),
    // A failed first page replaces the list; a later failure keeps the loaded rows and shows `failure` below them.
    error: lookupError ?? firstPageError,
    failure,
    hasMore: hasNextPage,
    isLoadingMore: isFetchingNextPage,
    loadMore: () => {
      void fetchNextPage();
    },
    // Refetching reloads every loaded page with fresh continuation tokens, so it also recovers from an expired one.
    retry: () => {
      if (lookupError) {
        retryLookup();
      } else {
        void refetch();
      }
    },
    // Only the first page's total counts; later pages repeat it and the count never drives paging.
    total: pages?.[0]?.total,
  };
}

/**
 * List view only: the issues of the List's search that the backend refused as invalid, for the search input.
 * It shares the List's cached search, so it sends no request of its own.
 */
export function useRecordingRuleSearchRejection(
  filter: RecordingRuleFilter,
  { parseIssues, mode }: { parseIssues: FilterIssue[]; mode: RuleListMode }
): FilterIssue[] {
  // There is no List search in Folders mode or for a query that doesn't parse, so skip rather than send one.
  const skip = parseIssues.length > 0 || mode === 'folders';
  const { search } = useRuleSearchApiArgs(filter, { skip });
  const { error } = useSearchRecordingRulesInfiniteQuery(search ?? skipToken);
  return useMemo(
    () => (search ? (getRejectionIssues(error, buildRecordingRuleLeaves(search)) ?? []) : []),
    [error, search]
  );
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
