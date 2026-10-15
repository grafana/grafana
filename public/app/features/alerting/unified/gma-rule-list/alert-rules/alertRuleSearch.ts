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

/** Infinite query keyed by criteria; the generated search is a POST mutation with no tags or page state. */
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
