import { rulesAPIv0alpha1 } from 'app/api/clients/rules/v0alpha1';
import type {
  ListAlertRuleApiResponse,
  ListRecordingRuleApiResponse,
} from 'app/api/clients/rules/v0alpha1/endpoints.gen';

interface PaginationParams {
  limit?: number;
  continueToken?: string;
}

export const k8sRulesApi = rulesAPIv0alpha1.injectEndpoints({
  endpoints: (build) => ({
    listAlertRulesWithPagination: build.query<ListAlertRuleApiResponse, PaginationParams>({
      query: ({ limit, continueToken }) => ({
        url: `/alertrules`,
        params: {
          limit,
          continue: continueToken,
        },
      }),
    }),
    listRecordingRulesWithPagination: build.query<ListRecordingRuleApiResponse, PaginationParams>({
      query: ({ limit, continueToken }) => ({
        url: `/recordingrules`,
        params: {
          limit,
          continue: continueToken,
        },
      }),
    }),
  }),
});

export const { useLazyListAlertRulesWithPaginationQuery, useLazyListRecordingRulesWithPaginationQuery } = k8sRulesApi;
