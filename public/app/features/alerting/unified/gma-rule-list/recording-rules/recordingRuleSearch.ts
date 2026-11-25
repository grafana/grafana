import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { generatedAPI } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type FilterIssue } from '../rule-search/parser';
import { getRejectionIssues } from '../rule-search/searchRejection';
import { type RuleSearchApiArgs } from '../rule-search/sharedRuleFilter';
import { type RuleListMode } from '../rule-search/useRuleListSearchState';
import { useRuleSearchApiArgs, withFolderLookup } from '../rule-search/useRuleSearchApiArgs';
import { type RuleSearchPage, ruleSearchPageQueryFn, useRuleSearchResult } from '../shared/ruleSearchPage';

import { type RecordingRuleFilter } from './recordingRuleFilters';
import { type RecordingRuleSearchHit, recordingRuleSearchHitSchema } from './recordingRuleSearchHit';
import { buildRecordingRuleLeaves, buildRecordingRuleSearchQuery } from './recordingRuleSearchQuery';

/**
 * Infinite query keyed by filter, so a new filter starts again from the first page. It wraps the generated
 * search, which has no tags or page state.
 */
const recordingRuleSearchAPI = generatedAPI.injectEndpoints({
  endpoints: (build) => ({
    searchRecordingRules: build.infiniteQuery<
      RuleSearchPage<RecordingRuleSearchHit>,
      RuleSearchApiArgs<RecordingRuleFilter>,
      string | undefined
    >({
      infiniteQueryOptions: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.continueToken || undefined,
      },
      // Results are a view of the current page only: leaving it drops them, and coming back searches again.
      keepUnusedDataFor: 0,
      queryFn: ruleSearchPageQueryFn({
        kind: 'recording',
        search: generatedAPI.endpoints.listRecordingRuleSearchRulesV0Alpha1,
        searchArg: (apiArgs, continueToken) => ({
          listRecordingRuleSearchRulesV0Alpha1RequestBody: buildRecordingRuleSearchQuery(apiArgs, continueToken),
        }),
        itemSchema: recordingRuleSearchHitSchema,
      }),
      providesTags: ['RecordingRule', 'RuleSequence'],
    }),
  }),
});

const { useSearchRecordingRulesInfiniteQuery } = recordingRuleSearchAPI;

export function useRecordingRuleSearch(filter: RecordingRuleFilter) {
  const folderLookup = useRuleSearchApiArgs('recording', filter);
  return withFolderLookup(
    folderLookup,
    useRuleSearchResult(useSearchRecordingRulesInfiniteQuery(folderLookup.apiArgs ?? skipToken))
  );
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
  const { apiArgs } = useRuleSearchApiArgs('recording', filter, { skip });
  const { error } = useSearchRecordingRulesInfiniteQuery(apiArgs ?? skipToken);
  return useMemo(
    () => (apiArgs ? (getRejectionIssues(error, buildRecordingRuleLeaves(apiArgs)) ?? []) : []),
    [error, apiArgs]
  );
}
