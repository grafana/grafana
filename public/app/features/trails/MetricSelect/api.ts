import { RawTimeRange } from '@grafana/data';
import { getPrometheusTime } from '@grafana/prometheus/src/language_utils';
import { getBackendSrv } from '@grafana/runtime';

type MetricValuesResponse = {
  data: string[];
  status: 'success' | 'error';
  error?: 'string';
  warnings?: string[];
};

type OtelResponse = {
  data: {
    result: [
      {
        metric: OtelResourcesType;
      },
    ];
  };
  status: 'success' | 'error';
  error?: 'string';
  warnings?: string[];
};

export type OtelResourcesType = {
  job: string;
  instance: string;
};

const OTEL_TARGET_INFO_QUERY = 'count(target_info{}) by (job, instance)';

const LIMIT_REACHED = 'results truncated due to limit';

export async function getMetricNames(dataSourceUid: string, timeRange: RawTimeRange, filters: string, limit?: number) {
  const url = `/api/datasources/uid/${dataSourceUid}/resources/api/v1/label/__name__/values`;
  const params: Record<string, string | number> = {
    start: getPrometheusTime(timeRange.from, false),
    end: getPrometheusTime(timeRange.to, true),
    ...(filters && filters !== '{}' ? { 'match[]': filters } : {}),
    ...(limit ? { limit } : {}),
  };

  const response = await getBackendSrv().get<MetricValuesResponse>(url, params, 'explore-metrics-names');

  if (limit && response.warnings?.includes(LIMIT_REACHED)) {
    return { ...response, limitReached: true };
  }

  return { ...response, limitReached: false };
}

/**
 * Query the DS for list of single series on target_info matching job and instance
 * parse the results to get label filters.
 * @param dataSourceUid
 * @param timeRange
 * @returns OtelResourcesType[], labels for the query result requesting matching job and instance on target_info metric
 */
export async function getOtelResources(dataSourceUid: string, timeRange: RawTimeRange): Promise<OtelResourcesType[]> {
  const url = `/api/datasources/uid/${dataSourceUid}/resources/api/v1/query`;
  const params: Record<string, string | number> = {
    start: getPrometheusTime(timeRange.from, false),
    end: getPrometheusTime(timeRange.to, true),
    query: OTEL_TARGET_INFO_QUERY,
  };

  const response = await getBackendSrv().get<OtelResponse>(url, params, 'explore-metrics-otel-resources');

  const resources = response.data?.result.map((el) => el.metric);

  return resources;
}
