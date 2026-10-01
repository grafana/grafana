import { type DataFrameJSON, type RawTimeRange, rangeUtil } from '@grafana/data';

import { alertingApi } from './alertingApi';

export const stateHistoryApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getRuleHistory: build.query<
      DataFrameJSON,
      {
        ruleUid?: string;
        timeRange: RawTimeRange;
        limit?: number;
        matchers?: string;
        previous?: string;
        current?: string;
      }
    >({
      query: ({ ruleUid, timeRange, limit = 100, matchers, previous, current }) => {
        // Resolve relative bounds like "now-30d" on every request so polling moves the time window forward.
        const resolvedTimeRange = rangeUtil.convertRawToRange(timeRange);
        const params: Record<string, string | number | undefined> = {
          ruleUID: ruleUid,
          from: resolvedTimeRange.from.unix(),
          to: resolvedTimeRange.to.unix(),
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
