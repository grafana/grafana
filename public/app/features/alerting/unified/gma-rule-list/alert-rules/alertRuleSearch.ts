import {
  type ListAlertRuleSearchRulesV0Alpha1ApiResponse,
  generatedAPI,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';
import { useDispatch } from 'app/types/store';

import { type Criteria } from '../rule-search/criteria';
import { type PagedResult, keepFirstPage, usePagedResult } from '../shared/pagedQuery';

import { type AlertRuleSearchHit, toAlertRuleSearchHit } from './alertRuleSearchHit';
import { buildAlertRuleSearchQuery } from './alertRuleSearchQuery';

export interface AlertRuleSearchPage {
  hits: AlertRuleSearchHit[];
  continueToken?: string;
}

/**
 * The single place that chooses which API endpoint serves Alert rule search. The generated
 * operation is a mutation (it is a POST), so it provides no tags and has no page state; this
 * injects the same request as an infinite query keyed by the criteria, with continuation tokens as
 * the page parameters. It provides the `AlertRule` tag, so every rule mutation refetches it.
 */
const alertRuleSearchAPI = generatedAPI.injectEndpoints({
  endpoints: (build) => ({
    searchAlertRules: build.infiniteQuery<AlertRuleSearchPage, Criteria, string | undefined>({
      infiniteQueryOptions: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.continueToken || undefined,
      },
      // Results are a view of the current page only; leaving it drops them.
      keepUnusedDataFor: 0,
      query: ({ queryArg, pageParam }) => ({
        url: '/alertrules/searchRules',
        method: 'POST',
        body: buildAlertRuleSearchQuery(queryArg, { continue: pageParam, limit: DEFAULT_PER_PAGE_PAGINATION }),
      }),
      transformResponse: (response: ListAlertRuleSearchRulesV0Alpha1ApiResponse): AlertRuleSearchPage => ({
        hits: response.items.map(toAlertRuleSearchHit),
        continueToken: response.metadata.continue,
      }),
      providesTags: ['AlertRule'],
    }),
  }),
});

const { useSearchAlertRulesInfiniteQuery } = alertRuleSearchAPI;

/** Alert rules matching the criteria, one page at a time, in the order the API returns them. */
export function useAlertRuleSearch(criteria: Criteria): PagedResult<AlertRuleSearchHit> {
  const dispatch = useDispatch();
  const query = useSearchAlertRulesInfiniteQuery(criteria, { refetchOnMountOrArgChange: true });

  return usePagedResult(query, getHits, () => {
    dispatch(alertRuleSearchAPI.util.updateQueryData('searchAlertRules', criteria, keepFirstPage));
  });
}

function getHits(page: AlertRuleSearchPage) {
  return page.hits;
}
