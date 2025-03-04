import { DataFrameJSON } from '@grafana/data';

import { parsePromQLStyleMatcherLoose } from '../utils/matchers';

import { alertingApi } from './alertingApi';

export const LABELS_PREFIX = 'labels_';

export function labelsDtoFromLabelsAsString(labels?: string): Record<string, string> {
  // convert "{ke1=val1,key2=val2}" to { labels_key1: val1, labels_key2: val2 }
  if (!labels) {
    return {};
  }

  const matchers = parsePromQLStyleMatcherLoose(labels);
  const result = matchers.reduce(
    (acc, matcher) => {
      acc[`${LABELS_PREFIX}${matcher.name}`] = matcher.value;
      return acc;
    },
    // eslint-disable-next-line
    {} as Record<string, string>
  );

  return result;
}

export const stateHistoryApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getRuleHistory: build.query<
      DataFrameJSON,
      { ruleUid?: string; from?: number; to?: number; limit?: number; labels?: string }
    >({
      query: ({ ruleUid, from, to, limit = 100, labels }) => ({
        url: '/api/v1/rules/history',
        params: { ruleUID: ruleUid, from, to, limit, ...labelsDtoFromLabelsAsString(labels) },
      }),
    }),
  }),
});
