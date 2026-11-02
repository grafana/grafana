import { useMemo } from 'react';
import * as z from 'zod';

import { generatedAPI } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type ResultTotal } from '../rule-row/ResultCount';
import { type FilterIssue } from '../rule-search/parser';
import { getRejectionIssues } from '../rule-search/searchRejection';
import { type RuleListMode } from '../rule-search/useRuleListSearchState';
import { type PagedFailure } from '../shared/PagedFailureAlert';

import { type AlertRuleFilter } from './alertRuleFilters';
import { type AlertRuleSearchHit, alertRuleSearchHitSchema } from './alertRuleSearchHit';
import { buildAlertRuleLeaves, buildAlertRuleSearchQuery } from './alertRuleSearchQuery';

interface AlertRuleSearchPage {
  hits: AlertRuleSearchHit[];
  continueToken?: string;
  total?: ResultTotal;
}

// Only what the list reads. The total is optional to show, so a bad one hides the count instead of failing the page.
const alertRuleSearchResponseSchema = z.object({
  items: z.array(alertRuleSearchHitSchema),
  metadata: z.object({
    continue: z.string().optional(),
    totalHits: z.number().optional().catch(undefined),
    totalHitsRelation: z.string().optional().catch(undefined),
  }),
});

type AlertRuleSearchResponse = z.infer<typeof alertRuleSearchResponseSchema>;

/**
 * Infinite query keyed by filter, so a new filter starts again from the first page. The generated
 * search is a POST mutation with no tags or page state.
 */
const alertRuleSearchAPI = generatedAPI.injectEndpoints({
  endpoints: (build) => ({
    searchAlertRules: build.infiniteQuery<AlertRuleSearchPage, AlertRuleFilter, string | undefined>({
      infiniteQueryOptions: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.continueToken || undefined,
      },
      // Results are a view of the current page only: leaving it drops them, and coming back searches again.
      keepUnusedDataFor: 0,
      query: ({ queryArg, pageParam }) => ({
        url: '/searchAlertRules',
        method: 'POST',
        body: buildAlertRuleSearchQuery(queryArg, pageParam),
      }),
      rawResponseSchema: alertRuleSearchResponseSchema,
      // A response that fails the schema becomes a query error, so the page shows it with Retry.
      catchSchemaFailure: (error) => ({ message: error.message }),
      transformResponse: (response: AlertRuleSearchResponse): AlertRuleSearchPage => ({
        hits: response.items,
        continueToken: response.metadata.continue,
        total: toResultTotal(response.metadata),
      }),
      providesTags: ['AlertRule'],
    }),
  }),
});

const { useSearchAlertRulesInfiniteQuery } = alertRuleSearchAPI;

export function useAlertRuleSearch(filter: AlertRuleFilter) {
  const query = useSearchAlertRulesInfiniteQuery(filter);
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

/**
 * The issues of a search the rule search refused as invalid, for the search input. It reads the same cached
 * search as the list, so it sends no request of its own.
 */
export function useAlertRuleSearchRejection(
  filter: AlertRuleFilter,
  { parseIssues, mode }: { parseIssues: FilterIssue[]; mode: RuleListMode }
): FilterIssue[] {
  // Folders mode sends no rule search for the page, and a filter that does not parse sends none either, so
  // there is no request to be rejected.
  const skip = parseIssues.length > 0 || mode === 'folders';
  const { error } = useSearchAlertRulesInfiniteQuery(filter, { skip });
  return useMemo(
    () => (skip ? [] : (getRejectionIssues(error, buildAlertRuleLeaves(filter)) ?? [])),
    [skip, error, filter]
  );
}

function toResultTotal({ totalHits, totalHitsRelation }: AlertRuleSearchResponse['metadata']): ResultTotal | undefined {
  if (totalHits === undefined) {
    return undefined;
  }
  return { count: totalHits, isLowerBound: totalHitsRelation === 'lte' };
}
