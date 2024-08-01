import { RawTimeRange } from '@grafana/data';
import { getPrometheusTime } from '@grafana/prometheus/src/language_utils';
import { getBackendSrv } from '@grafana/runtime';

import { OtelTargetType, OtelResponse } from './types';

/** This ensures we can join on a single series target*/
const OTEL_TARGET_INFO_QUERY = 'count(target_info{}) by (job, instance)'; // == 1';

/**
 * Query the DS for target_info matching job and instance.
 * Parse the results to get label filters.
 * @param dataSourceUid
 * @param timeRange
 * @returns OtelResourcesType[], labels for the query result requesting matching job and instance on target_info metric
 */
export async function getOtelTargets(
  dataSourceUid: string,
  timeRange: RawTimeRange,
  expr?: string
): Promise<OtelTargetType[]> {
  const url = `/api/datasources/uid/${dataSourceUid}/resources/api/v1/query`;
  const params: Record<string, string | number> = {
    start: getPrometheusTime(timeRange.from, false),
    end: getPrometheusTime(timeRange.to, true),
    query: expr ?? OTEL_TARGET_INFO_QUERY,
  };

  const response = await getBackendSrv().get<OtelResponse>(url, params, 'explore-metrics-otel-targets');

  const resources = response.data?.result.map((el) => el.metric);

  return resources;
}
