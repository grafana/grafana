import { type DataFrameJSON, dateTimeParse } from '@grafana/data';

import { alertingApi } from './alertingApi';

export const stateHistoryApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getRuleHistory: build.query<
      DataFrameJSON,
      {
        ruleUid?: string;
        from?: number | string;
        to?: number | string;
        limit?: number;
        matchers?: string;
        previous?: string;
        current?: string;
      }
    >({
      query: ({ ruleUid, from, to, limit = 100, matchers, previous, current }) => {
        // Resolve relative bounds for each request so polling advances the time window.
        const params: Record<string, string | number | undefined> = {
          ruleUID: ruleUid,
          from: parseTimeBound(from, false),
          to: parseTimeBound(to, true),
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

function parseTimeBound(value: number | string | undefined, roundUp: boolean): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'number') {
    return value;
  }

  // Normally the dateTimeParse doesn't throw, only in very specific circumstances, but the backing library isn't
  // guarantied (moment vs luxon for example)
  try {
    const parsed = dateTimeParse(value, { roundUp });
    if (!parsed.isValid()) {
      return undefined;
    }
    const timestamp = parsed.unix();
    return Number.isFinite(timestamp) ? timestamp : undefined;
  } catch {
    return undefined;
  }
}
