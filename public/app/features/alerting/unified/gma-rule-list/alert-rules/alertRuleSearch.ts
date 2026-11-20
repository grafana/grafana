import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { generatedAPI } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type FilterIssue } from '../rule-search/parser';
import { getRejectionIssues } from '../rule-search/searchRejection';
import { type RuleSearchApiArgs } from '../rule-search/sharedRuleFilter';
import { type RuleListMode } from '../rule-search/useRuleListSearchState';
import { useRuleSearchApiArgs, withFolderLookup } from '../rule-search/useRuleSearchApiArgs';
import { type RuleSearchPage, ruleSearchPageQueryFn, useRuleSearchResult } from '../shared/ruleSearchPage';

import { type AlertRuleFilter } from './alertRuleFilters';
import { type AlertRuleSearchHit, alertRuleSearchHitSchema } from './alertRuleSearchHit';
import { buildAlertRuleLeaves, buildAlertRuleSearchQuery } from './alertRuleSearchQuery';

/**
 * Infinite query keyed by filter, so a new filter starts again from the first page. It wraps the generated
 * search, which has no tags or page state.
 */
const alertRuleSearchAPI = generatedAPI.injectEndpoints({
  endpoints: (build) => ({
    searchAlertRules: build.infiniteQuery<
      RuleSearchPage<AlertRuleSearchHit>,
      RuleSearchApiArgs<AlertRuleFilter>,
      string | undefined
    >({
      infiniteQueryOptions: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.continueToken || undefined,
      },
      // Results are a view of the current page only: leaving it drops them, and coming back searches again.
      keepUnusedDataFor: 0,
      queryFn: ruleSearchPageQueryFn({
        kind: 'alert',
        search: generatedAPI.endpoints.listAlertRuleSearchRulesV0Alpha1,
        searchArg: (apiArgs, continueToken) => ({
          listAlertRuleSearchRulesV0Alpha1RequestBody: buildAlertRuleSearchQuery(apiArgs, continueToken),
        }),
        itemSchema: alertRuleSearchHitSchema,
      }),
      providesTags: ['AlertRule', 'RuleSequence'],
    }),
  }),
});

const { useSearchAlertRulesInfiniteQuery } = alertRuleSearchAPI;

export function useAlertRuleSearch(filter: AlertRuleFilter) {
  const lookup = useRuleSearchApiArgs('alert', filter);
  return withFolderLookup(lookup, useRuleSearchResult(useSearchAlertRulesInfiniteQuery(lookup.apiArgs ?? skipToken)));
}

/**
 * List view only: the issues of the List's search that the backend refused as invalid, for the search input.
 * It shares the List's cached search, so it sends no request of its own.
 */
export function useAlertRuleSearchRejection(
  filter: AlertRuleFilter,
  { parseIssues, mode }: { parseIssues: FilterIssue[]; mode: RuleListMode }
): FilterIssue[] {
  // There is no List search in Folders mode or for a query that doesn't parse, so skip rather than send one.
  const skip = parseIssues.length > 0 || mode === 'folders';
  const { apiArgs } = useRuleSearchApiArgs('alert', filter, { skip });
  const { error } = useSearchAlertRulesInfiniteQuery(apiArgs ?? skipToken);
  return useMemo(
    () => (apiArgs ? (getRejectionIssues(error, buildAlertRuleLeaves(apiArgs)) ?? []) : []),
    [error, apiArgs]
  );
}
