import { type RecordingRule, generatedAPI } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import {
  type UseDeletedRulesResult,
  deletedRulesPageQueryFn,
  useDeletedRulesResult,
} from '../deleted-rules/deletedRulesPage';

const trashAPI = generatedAPI.injectEndpoints({
  endpoints: (build) => ({
    listDeletedRecordingRules: build.infiniteQuery<
      { items: RecordingRule[]; continueToken?: string },
      void,
      string | undefined
    >({
      infiniteQueryOptions: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.continueToken || undefined,
      },
      keepUnusedDataFor: 0,
      queryFn: deletedRulesPageQueryFn<RecordingRule>(generatedAPI.endpoints.listRecordingRule),
      providesTags: ['RecordingRule'],
    }),
  }),
});

const { useListDeletedRecordingRulesInfiniteQuery } = trashAPI;

export function useDeletedRecordingRules(): UseDeletedRulesResult<RecordingRule> {
  return useDeletedRulesResult(
    useListDeletedRecordingRulesInfiniteQuery(undefined, { refetchOnMountOrArgChange: true })
  );
}
