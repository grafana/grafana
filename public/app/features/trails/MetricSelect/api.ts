import { AdHocVariableFilter, RawTimeRange, Scope } from '@grafana/data';

import { callSuggestionsApi } from '../utils';

const LIMIT_REACHED = 'results truncated due to limit';

export async function getMetricNames(
  dataSourceUid: string,
  timeRange: RawTimeRange,
  scopes: Scope[],
  filters: AdHocVariableFilter[],
  limit?: number
) {
  const response = await callSuggestionsApi(
    dataSourceUid,
    timeRange,
    scopes,
    filters,
    '__name__',
    limit,
    'explore-metrics-names'
  );

  return {
    ...response.data,
    limitReached: limit && !!response.data.warnings?.includes(LIMIT_REACHED),
  };
}
