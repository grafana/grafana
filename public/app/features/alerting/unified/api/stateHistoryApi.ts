import { DataFrameJSON } from '@grafana/data';

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
        labels?: Record<string, string>;
        previous?: string;
        current?: string;
      }
    >({
      query: ({ ruleUid, from, to, limit = 100, labels, previous, current }) => {
        const params: Record<string, string | number | undefined> = {
          ruleUID: ruleUid,
          from,
          to,
          limit,
        };

        if (labels) {
          Object.entries(labels).forEach(([key, value]) => {
            params[`labels_${key}`] = value;
          });
        }

        if (previous) {
          params.previous = previous;
        }

        if (current) {
          params.current = current;
        }

        return {
          url: '/api/v1/rules/history',
          params,
        };
      },
    }),
  }),
});
