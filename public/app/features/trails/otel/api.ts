import { RawTimeRange } from '@grafana/data';
import { getPrometheusTime } from '@grafana/prometheus/src/language_utils';
import { getBackendSrv } from '@grafana/runtime';

import { OtelResponse, LabelResponse } from './types';

/** This ensures we can join on a single series target*/
const OTEL_TARGET_INFO_QUERY = 'count(target_info{}) by (job, instance)';
const OTEL_RESOURCE_EXCLUDED_FILTERS = ['__name__', 'deployment_environment'];

/**
 * Query the DS for target_info matching job and instance.
 * Parse the results to get label filters.
 * @param dataSourceUid
 * @param timeRange
 * @returns OtelResourcesType[], labels for the query result requesting matching job and instance on target_info metric
 */
export async function getOtelResources(
  dataSourceUid: string,
  timeRange: RawTimeRange,
  excludeFilters?: string[]
): Promise<string[]> {
  const allExcludedFilters = (excludeFilters ?? []).concat(OTEL_RESOURCE_EXCLUDED_FILTERS);

  const start = getPrometheusTime(timeRange.from, false);
  const end = getPrometheusTime(timeRange.to, true);

  const url = `/api/datasources/uid/${dataSourceUid}/resources/api/v1/labels`;
  const params: Record<string, string | number> = {
    start,
    end,
    'match[]': '{__name__=~".*target_info.*"}',
  };

  const response = await getBackendSrv().get<LabelResponse>(url, params, 'explore-metrics-otel-resources');

  // exclude __name__ or deployment_environment or previously chosen filters
  const resources = response.data?.filter((resource) => !allExcludedFilters.includes(resource)).map((el: string) => el);

  return resources;
}

export async function isOtelStandardization(
  dataSourceUid: string,
  timeRange: RawTimeRange,
  expr?: string
): Promise<boolean> {
  const start = getPrometheusTime(timeRange.from, false);
  const end = getPrometheusTime(timeRange.to, true);

  const url = `/api/datasources/uid/${dataSourceUid}/resources/api/v1/query`;
  const paramsTotalTargets: Record<string, string | number> = {
    start,
    end,
    query: OTEL_TARGET_INFO_QUERY,
  };

  const responseTotal = await getBackendSrv().get<OtelResponse>(
    url,
    paramsTotalTargets,
    'explore-metrics-otel-check-total'
  );

  const paramsStandardTargets: Record<string, string | number> = {
    start,
    end,
    query: `${OTEL_TARGET_INFO_QUERY} == 1`,
  };

  const responseStandard = await getBackendSrv().get<OtelResponse>(
    url,
    paramsStandardTargets,
    'explore-metrics-otel-check-standard'
  );

  return responseTotal.data.result.length === responseStandard.data.result.length;
}
