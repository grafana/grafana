import {
  type ListRecordingRuleSearchRulesV0Alpha1ApiResponse,
  generatedAPI,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';
import { useDispatch } from 'app/types/store';

import { type Criteria } from '../rule-search/criteria';
import { type PagedResult, keepFirstPage, usePagedResult } from '../shared/pagedQuery';

import { type RecordingRuleSearchHit, toRecordingRuleSearchHit } from './recordingRuleSearchHit';
import { buildRecordingRuleSearchQuery } from './recordingRuleSearchQuery';

export interface RecordingRuleSearchPage {
  hits: RecordingRuleSearchHit[];
  continueToken?: string;
}

/**
 * The single place that chooses which API endpoint serves Recording rule search. The generated
 * operation is a mutation (it is a POST), so it provides no tags and has no page state; this
 * injects the same request as an infinite query keyed by the criteria, with continuation tokens as
 * the page parameters. It provides the `RecordingRule` tag, so every rule mutation refetches it.
 */
const recordingRuleSearchAPI = generatedAPI.injectEndpoints({
  endpoints: (build) => ({
    searchRecordingRules: build.infiniteQuery<RecordingRuleSearchPage, Criteria, string | undefined>({
      infiniteQueryOptions: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.continueToken || undefined,
      },
      // Results are a view of the current page only; leaving it drops them.
      keepUnusedDataFor: 0,
      query: ({ queryArg, pageParam }) => ({
        url: '/recordingrules/searchRules',
        method: 'POST',
        body: buildRecordingRuleSearchQuery(queryArg, { continue: pageParam, limit: DEFAULT_PER_PAGE_PAGINATION }),
      }),
      transformResponse: (response: ListRecordingRuleSearchRulesV0Alpha1ApiResponse): RecordingRuleSearchPage => ({
        hits: response.items.map(toRecordingRuleSearchHit),
        continueToken: response.metadata.continue,
      }),
      providesTags: ['RecordingRule'],
    }),
  }),
});

const { useSearchRecordingRulesInfiniteQuery } = recordingRuleSearchAPI;

/** Recording rules matching the criteria, one page at a time, in the order the API returns them. */
export function useRecordingRuleSearch(criteria: Criteria): PagedResult<RecordingRuleSearchHit> {
  const dispatch = useDispatch();
  const query = useSearchRecordingRulesInfiniteQuery(criteria, { refetchOnMountOrArgChange: true });

  return usePagedResult(query, getHits, () => {
    dispatch(recordingRuleSearchAPI.util.updateQueryData('searchRecordingRules', criteria, keepFirstPage));
  });
}

function getHits(page: RecordingRuleSearchPage) {
  return page.hits;
}
