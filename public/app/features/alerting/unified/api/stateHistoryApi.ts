import { type DataFrameJSON, type RawTimeRange, rangeUtil } from '@grafana/data';

import { alertingApi } from './alertingApi';

export const stateHistoryApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getRuleHistory: build.query<
      DataFrameJSON,
      {
        ruleUid?: string;
        from?: number;
        to?: number;
        timeRange?: RawTimeRange;
        limit?: number;
        matchers?: string;
        previous?: string;
        current?: string;
      }
    >({
      query: ({ ruleUid, from, to, timeRange, limit = 100, matchers, previous, current }) => {
        // Resolve relative bounds for each request so polling advances the time window.
        const resolvedTimeRange = timeRange && rangeUtil.convertRawToRange(timeRange);
        const params: Record<string, string | number | undefined> = {
          ruleUID: ruleUid,
          from: resolvedTimeRange?.from.unix() ?? from,
          to: resolvedTimeRange?.to.unix() ?? to,
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
