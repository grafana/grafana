import {
  type ListRecordingRuleSearchRulesV0Alpha1ApiResponse,
  type ListRecordingRuleSearchRulesV0Alpha1SearchResultsMetadata,
  generatedAPI,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useDispatch } from 'app/types/store';

import { type ResultTotal } from '../rule-row/ResultCount';
import { type RuleSearchFilter } from '../rule-search/ruleSearchFilter';
import { type PagedResult, keepFirstPage, usePagedResult } from '../shared/pagedQuery';

import { type RecordingRuleSearchHit, toRecordingRuleSearchHit } from './recordingRuleSearchHit';
import { buildRecordingRuleSearchQuery } from './recordingRuleSearchQuery';

export interface RecordingRuleSearchPage {
  hits: RecordingRuleSearchHit[];
  continueToken?: string;
  total?: ResultTotal;
}

/** Infinite query keyed by filter; the generated search is a POST mutation with no tags or page state. */
const recordingRuleSearchAPI = generatedAPI.injectEndpoints({
  endpoints: (build) => ({
    searchRecordingRules: build.infiniteQuery<RecordingRuleSearchPage, RuleSearchFilter, string | undefined>({
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
      transformResponse: (response: ListRecordingRuleSearchRulesV0Alpha1ApiResponse): RecordingRuleSearchPage => ({
        hits: response.items.map(toRecordingRuleSearchHit),
        continueToken: response.metadata.continue,
        total: toResultTotal(response.metadata),
      }),
      providesTags: ['RecordingRule'],
    }),
  }),
});

const { useSearchRecordingRulesInfiniteQuery } = recordingRuleSearchAPI;

export function useRecordingRuleSearch(
  filter: RuleSearchFilter
): PagedResult<RecordingRuleSearchHit> & { total?: ResultTotal } {
  const dispatch = useDispatch();
  const query = useSearchRecordingRulesInfiniteQuery(filter);

  const paged = usePagedResult(query, getHits, () => {
    dispatch(recordingRuleSearchAPI.util.updateQueryData('searchRecordingRules', filter, keepFirstPage));
  });

  // Only the first page's total counts; later pages repeat it and the count never drives paging.
  return { ...paged, total: query.currentData?.pages[0]?.total };
}

function getHits(page: RecordingRuleSearchPage) {
  return page.hits;
}

/** `totalHits` is typed as required but guarded, since the count is optional to show. */
function toResultTotal(metadata: ListRecordingRuleSearchRulesV0Alpha1SearchResultsMetadata): ResultTotal | undefined {
  if (typeof metadata.totalHits !== 'number') {
    return undefined;
  }
  return { count: metadata.totalHits, isLowerBound: metadata.totalHitsRelation === 'lte' };
}
