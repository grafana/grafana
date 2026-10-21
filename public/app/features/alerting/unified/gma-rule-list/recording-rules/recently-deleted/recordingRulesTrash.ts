import {
  type RecordingRule,
  type RecordingRuleList,
  generatedAPI,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';
import { useDispatch } from 'app/types/store';

import { TRASH_SELECTOR } from '../../recently-deleted/trashSelector';
import { type UseDeletedRulesResult, useDeletedRules } from '../../recently-deleted/useDeletedRules';
import { keepFirstPage } from '../../shared/pagedQuery';

/** The generated `listRecordingRule` cannot follow continuation tokens; this wraps it as a tagged infinite query. */
const recordingRulesTrashAPI = generatedAPI.injectEndpoints({
  endpoints: (build) => ({
    listDeletedRecordingRules: build.infiniteQuery<RecordingRuleList, void, string | undefined>({
      infiniteQueryOptions: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.metadata.continue || undefined,
      },
      // Results are a view of the current page only: leaving it drops them, and coming back loads the list again.
      keepUnusedDataFor: 0,
      query: ({ pageParam }) => ({
        url: '/recordingrules',
        params: { labelSelector: TRASH_SELECTOR, limit: DEFAULT_PER_PAGE_PAGINATION, continue: pageParam },
      }),
      providesTags: ['RecordingRule'],
    }),
  }),
});

const { useListDeletedRecordingRulesInfiniteQuery } = recordingRulesTrashAPI;

export function useDeletedRecordingRules(): UseDeletedRulesResult<RecordingRule> {
  const dispatch = useDispatch();
  const query = useListDeletedRecordingRulesInfiniteQuery(undefined);

  return useDeletedRules(query, () => {
    dispatch(recordingRulesTrashAPI.util.updateQueryData('listDeletedRecordingRules', undefined, keepFirstPage));
  });
}
