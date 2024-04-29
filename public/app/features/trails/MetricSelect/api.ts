import { RawTimeRange } from '@grafana/data';
import { getPrometheusTime } from '@grafana/prometheus/src/language_utils';
import { getBackendSrv } from '@grafana/runtime';

type MetricValuesResponse = {
  data: string[];
  status: 'success' | 'error';
  error?: 'string';
  warnings?: string[];
};

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
