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

/**
 * The deleted Recording rules, from the same collection request as the generated `listRecordingRule`
 * with the trash selector. That operation is a plain query that cannot follow continuation
 * tokens, so this injects it as an infinite query. It provides the `RecordingRule` tag, so rule
 * mutations refetch it.
 */
const recordingRulesTrashAPI = generatedAPI.injectEndpoints({
  endpoints: (build) => ({
    listDeletedRecordingRules: build.infiniteQuery<RecordingRuleList, void, string | undefined>({
      infiniteQueryOptions: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.metadata.continue || undefined,
      },
      // The list is a view of the current page only; leaving it drops it.
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
  const query = useListDeletedRecordingRulesInfiniteQuery(undefined, { refetchOnMountOrArgChange: true });

  return useDeletedRules(query, () => {
    dispatch(recordingRulesTrashAPI.util.updateQueryData('listDeletedRecordingRules', undefined, keepFirstPage));
  });
}
