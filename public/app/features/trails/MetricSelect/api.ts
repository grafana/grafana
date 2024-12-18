import { AdHocVariableFilter, RawTimeRange, Scope } from '@grafana/data';
import { getPrometheusTime } from '@grafana/prometheus/src/language_utils';
import { PromQueryModeller } from '@grafana/prometheus/src/querybuilder/PromQueryModeller';
import { config, getBackendSrv } from '@grafana/runtime';

import { limitOtelMatchTerms } from '../otel/util';
import { callSuggestionsApi, SuggestionsResponse } from '../utils';

const LIMIT_REACHED = 'results truncated due to limit';

const queryModeller = new PromQueryModeller();

export async function getMetricNames(
  dataSourceUid: string,
  timeRange: RawTimeRange,
  scopes: Scope[],
  filters: AdHocVariableFilter[],
  jobs: string[],
  instances: string[],
  limit?: number
): Promise<SuggestionsResponse & { limitReached: boolean; missingOtelTargets: boolean }> {
  if (!config.featureToggles.enableScopesInMetricsExplore) {
    return await getMetricNamesWithoutScopes(dataSourceUid, timeRange, filters, jobs, instances, limit);
  }

  return getMetricNamesWithScopes(dataSourceUid, timeRange, scopes, filters, jobs, instances, limit);
}

export async function getMetricNamesWithoutScopes(
  dataSourceUid: string,
  timeRange: RawTimeRange,
  adhocFilters: AdHocVariableFilter[],
  jobs: string[],
  instances: string[],
  limit?: number
) {
  const matchTerms = config.featureToggles.prometheusSpecialCharsInLabelValues
    ? adhocFilters.map((filter) =>
        removeBrackets(queryModeller.renderLabels([{ label: filter.key, op: filter.operator, value: filter.value }]))
      )
    : adhocFilters.map((filter) => `${filter.key}${filter.operator}"${filter.value}"`);
  let missingOtelTargets = false;

  if (jobs.length > 0 && instances.length > 0) {
    const otelMatches = limitOtelMatchTerms(matchTerms, jobs, instances);
    missingOtelTargets = otelMatches.missingOtelTargets;
    matchTerms.push(otelMatches.jobsRegex);
    matchTerms.push(otelMatches.instancesRegex);
  }

  const filters = `{${matchTerms.join(',')}}`;

  const url = `/api/datasources/uid/${dataSourceUid}/resources/api/v1/label/__name__/values`;
  const params: Record<string, string | number> = {
    start: getPrometheusTime(timeRange.from, false),
    end: getPrometheusTime(timeRange.to, true),
    ...(filters && filters !== '{}' ? { 'match[]': filters } : {}),
    ...(limit ? { limit } : {}),
  };

  const response = await getBackendSrv().get<SuggestionsResponse>(url, params, 'explore-metrics-names');

  if (limit && response.warnings?.includes(LIMIT_REACHED)) {
    return { ...response, limitReached: true, missingOtelTargets };
  }

  return { ...response, limitReached: false, missingOtelTargets };
}

export async function getMetricNamesWithScopes(
  dataSourceUid: string,
  timeRange: RawTimeRange,
  scopes: Scope[],
  filters: AdHocVariableFilter[],
  jobs: string[],
  instances: string[],
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

  if (jobs.length > 0 && instances.length > 0) {
    filters.push({
      key: 'job',
      operator: '=~',
      value: jobs?.join('|') || '',
    });

    filters.push({
      key: 'instance',
      operator: '=~',
      value: instances?.join('|') || '',
    });
  }

  return {
    ...response.data,
    limitReached: !!limit && !!response.data.warnings?.includes(LIMIT_REACHED),
    missingOtelTargets: false,
  };
}

function removeBrackets(input: string): string {
  const match = input.match(/^\{(.*)\}$/); // extract the content inside the brackets
  return match?.[1] ?? '';
}
