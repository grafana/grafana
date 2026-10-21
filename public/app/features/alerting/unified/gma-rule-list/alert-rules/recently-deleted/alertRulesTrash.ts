import { type AlertRule, type AlertRuleList, generatedAPI } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';
import { useDispatch } from 'app/types/store';

import { TRASH_SELECTOR } from '../../recently-deleted/trashSelector';
import { type UseDeletedRulesResult, useDeletedRules } from '../../recently-deleted/useDeletedRules';
import { keepFirstPage } from '../../shared/pagedQuery';

/** Infinite query, since the generated one cannot follow continuation tokens. */
const alertRulesTrashAPI = generatedAPI.injectEndpoints({
  endpoints: (build) => ({
    listDeletedAlertRules: build.infiniteQuery<AlertRuleList, void, string | undefined>({
      infiniteQueryOptions: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.metadata.continue || undefined,
      },
      // Results are a view of the current page only: leaving it drops them, and coming back loads the list again.
      keepUnusedDataFor: 0,
      query: ({ pageParam }) => ({
        url: '/alertrules',
        params: { labelSelector: TRASH_SELECTOR, limit: DEFAULT_PER_PAGE_PAGINATION, continue: pageParam },
      }),
      providesTags: ['AlertRule'],
    }),
  }),
});

const { useListDeletedAlertRulesInfiniteQuery } = alertRulesTrashAPI;

export function useDeletedAlertRules(): UseDeletedRulesResult<AlertRule> {
  const dispatch = useDispatch();
  const query = useListDeletedAlertRulesInfiniteQuery(undefined);

  return useDeletedRules(query, () => {
    dispatch(alertRulesTrashAPI.util.updateQueryData('listDeletedAlertRules', undefined, keepFirstPage));
  });
}
