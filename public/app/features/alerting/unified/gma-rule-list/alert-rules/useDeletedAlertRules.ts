import { type AlertRule, generatedAPI } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import {
  PAGE_SIZE,
  TRASH_LABEL_SELECTOR,
  type UseDeletedRulesResult,
  deletedRulesPageQueryFn,
  useDeletedRulesResult,
} from '../deleted-rules/deletedRulesPage';

const trashAPI = generatedAPI.injectEndpoints({
  endpoints: (build) => ({
    listDeletedAlertRules: build.infiniteQuery<
      { items: AlertRule[]; continueToken?: string },
      void,
      string | undefined
    >({
      infiniteQueryOptions: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.continueToken || undefined,
      },
      keepUnusedDataFor: 0,
      queryFn: deletedRulesPageQueryFn<AlertRule>(generatedAPI.endpoints.listAlertRule),
      providesTags: ['AlertRule'],
    }),
  }),
});

const { useListDeletedAlertRulesInfiniteQuery } = trashAPI;

export function useDeletedAlertRules(): UseDeletedRulesResult<AlertRule> {
  return useDeletedRulesResult(useListDeletedAlertRulesInfiniteQuery(undefined, { refetchOnMountOrArgChange: true }));
}
