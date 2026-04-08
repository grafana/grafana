import { type DataFrameJSON } from '@grafana/data';

import { alertingApi } from './alertingApi';

export const stateHistoryApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getRuleHistory: build.query<
      DataFrameJSON,
      {
        ruleUid?: string;
        from?: number;
        to?: number;
        limit?: number;
        matchers?: string;
        previous?: string;
        current?: string;
      }
    >({
      query: ({ ruleUid, from, to, limit = 100, matchers, previous, current }) => {
        const params: Record<string, string | number | undefined> = {
          ruleUID: ruleUid,
          from,
          to,
          limit,
          previous,
          current,
          matchers,
        };

        return {
          url: '/api/v1/rules/history',
          params,
        };
      },
    }),
  }),
});
