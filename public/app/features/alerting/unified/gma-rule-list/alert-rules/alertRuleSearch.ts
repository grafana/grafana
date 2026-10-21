import {
  type ListAlertRuleSearchRulesV0Alpha1ApiResponse,
  generatedAPI,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useDispatch } from 'app/types/store';

import { type ResultTotal, toResultTotal } from '../rule-row/ResultCount';
import { type PagedResult, keepFirstPage, usePagedResult } from '../shared/pagedQuery';

import { type AlertRuleSearchHit, toAlertRuleSearchHit } from './alertRuleSearchHit';
import { buildAlertRuleSearchQuery } from './alertRuleSearchQuery';

interface AlertRuleSearchPage {
  hits: AlertRuleSearchHit[];
  continueToken?: string;
  total?: ResultTotal;
}

/** Infinite query; the generated search is a POST mutation with no tags or page state. */
const alertRuleSearchAPI = generatedAPI.injectEndpoints({
  endpoints: (build) => ({
    searchAlertRules: build.infiniteQuery<AlertRuleSearchPage, void, string | undefined>({
      infiniteQueryOptions: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.continueToken || undefined,
      },
      // Results are a view of the current page only: leaving it drops them, and coming back searches again.
      keepUnusedDataFor: 0,
      query: ({ pageParam }) => ({
        url: '/searchAlertRules',
        method: 'POST',
        body: buildAlertRuleSearchQuery(pageParam),
      }),
      transformResponse: (response: ListAlertRuleSearchRulesV0Alpha1ApiResponse): AlertRuleSearchPage => ({
        hits: response.items.map(toAlertRuleSearchHit),
        continueToken: response.metadata.continue,
        total: toResultTotal(response.metadata),
      }),
      providesTags: ['AlertRule'],
    }),
  }),
});

const { useSearchAlertRulesInfiniteQuery } = alertRuleSearchAPI;

export function useAlertRuleSearch(): PagedResult<AlertRuleSearchHit> & { total?: ResultTotal } {
  const dispatch = useDispatch();
  const query = useSearchAlertRulesInfiniteQuery();

  const paged = usePagedResult(query, getHits, () => {
    dispatch(alertRuleSearchAPI.util.updateQueryData('searchAlertRules', undefined, keepFirstPage));
  });

  // Only the first page's total counts; later pages repeat it and the count never drives paging.
  return { ...paged, total: query.currentData?.pages[0]?.total };
}

function getHits(page: AlertRuleSearchPage) {
  return page.hits;
}
