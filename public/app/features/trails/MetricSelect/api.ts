import { AdHocVariableFilter, RawTimeRange, Scope } from '@grafana/data';
import { getPrometheusTime } from '@grafana/prometheus/src/language_utils';
import { config, getBackendSrv } from '@grafana/runtime';

import { callSuggestionsApi, SuggestionsResponse } from '../utils';

const LIMIT_REACHED = 'results truncated due to limit';

export async function getMetricNames(
  dataSourceUid: string,
  timeRange: RawTimeRange,
  scopes: Scope[],
  filters: AdHocVariableFilter[],
  limit?: number
) {
  if (!config.featureToggles.enableScopesInMetricsExplore) {
    const matchTerms = filters.map((filter) => `${filter.key}${filter.operator}"${filter.value}"`);
    const match = `${matchTerms.join(',')}`;

    return getMetricNamesWithoutScopes(dataSourceUid, timeRange, match, limit);
  }

  return getMetricNamesWithScopes(dataSourceUid, timeRange, scopes, filters, limit);
}

export async function getMetricNamesWithoutScopes(
  dataSourceUid: string,
  timeRange: RawTimeRange,
  filters: string,
  limit?: number
) {
  const url = `/api/datasources/uid/${dataSourceUid}/resources/api/v1/label/__name__/values`;
  const params: Record<string, string | number> = {
    start: getPrometheusTime(timeRange.from, false),
    end: getPrometheusTime(timeRange.to, true),
    ...(filters && filters !== '{}' ? { 'match[]': filters } : {}),
    ...(limit ? { limit } : {}),
  };

  const response = await getBackendSrv().get<SuggestionsResponse>(url, params, 'explore-metrics-names');

  if (limit && response.warnings?.includes(LIMIT_REACHED)) {
    return { ...response, limitReached: true };
  }

  return { ...response, limitReached: false };
}

export async function getMetricNamesWithScopes(
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
