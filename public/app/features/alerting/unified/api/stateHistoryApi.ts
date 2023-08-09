import { DataFrameJSON } from '@grafana/data';

import { alertingApi } from './alertingApi';

export const stateHistoryApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getRuleHistory: build.query<DataFrameJSON, { ruleUid: string; from?: number; to?: number; limit?: number }>({
      query: ({ ruleUid, from, to, limit = 100 }) => ({
        url: '/api/v1/rules/history',
        params: { ruleUID: ruleUid, from, to, limit },
      }),
    }),
  }),
});
