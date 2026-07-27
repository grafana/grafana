import { getAPINamespace } from '@grafana/api-clients';
import { type FieldSparkline } from '@grafana/data';

import { listProbeCandidates, PROBE_TIMEOUT_MS, withRetry } from './probeUtils';
import { readScalar, readSeries, runInstantQueries, runRangeQuery } from './promQuery';

/** Grafana Metrics Drilldown app plugin ID. @lintignore */
export const METRICS_DRILLDOWN_APP_ID = 'grafana-metricsdrilldown-app';

const CLOUD_USAGE_DATASOURCE_UID = 'grafanacloud-usage';

export interface MetricsOverview {
  activeSeries: number;
  dataPointsPerMinute: number | null;
  queries: {
    datasourceUid: string;
    activeSeries: string;
    dataPointsPerMinute: string;
  };
}

async function resolveMetricsQueries(): Promise<MetricsOverview['queries'] | null> {
  const namespace = getAPINamespace();
  const stackId = namespace.startsWith('stacks-') ? namespace.slice('stacks-'.length) : '';
  const [datasource] = await listProbeCandidates('prometheus', {
    cap: 1,
    preferredUids: stackId ? [CLOUD_USAGE_DATASOURCE_UID] : [],
  });
  if (!datasource) {
    // There is no queryable metrics source.
    return null;
  }

  if (datasource.uid !== CLOUD_USAGE_DATASOURCE_UID) {
    // Ordinary Prometheus sources expose their own series and ingestion totals.
    return {
      datasourceUid: datasource.uid,
      activeSeries: 'sum(prometheus_tsdb_head_series)',
      dataPointsPerMinute: '60 * sum(rate(prometheus_tsdb_head_samples_appended_total[5m]))',
    };
  }

  if (datasource.uid === CLOUD_USAGE_DATASOURCE_UID && stackId) {
    // Cloud usage provides stack-scoped series and ingestion totals.
    return {
      datasourceUid: datasource.uid,
      activeSeries: `sum(grafanacloud_instance_active_series{stack_id="${stackId}"})`,
      dataPointsPerMinute: `60 * sum(grafanacloud_instance_samples_per_second{stack_id="${stackId}"})`,
    };
  }

  // Never query the shared usage datasource without a stack scope.
  return null;
}

async function fetchOverview(queries: MetricsOverview['queries']): Promise<MetricsOverview | null> {
  const { datasourceUid, ...expressions } = queries;
  const frames = await withRetry(() =>
    runInstantQueries(expressions, { uid: datasourceUid, type: 'prometheus' }, PROBE_TIMEOUT_MS)
  );
  const activeSeries = readScalar(frames, 'activeSeries');
  const dataPointsPerMinute = readScalar(frames, 'dataPointsPerMinute');
  if (activeSeries === null || activeSeries <= 0) {
    return null;
  }

  return {
    activeSeries,
    dataPointsPerMinute,
    queries,
  };
}

/** Metrics usage summary from the Cloud usage datasource, or the first available Prometheus datasource. */
export async function fetchMetricsOverview(): Promise<MetricsOverview | null> {
  const queries = await resolveMetricsQueries();
  return queries ? fetchOverview(queries) : null;
}

/** Active-series history over the last 24 hours. */
export async function fetchMetricsHistory(overview: MetricsOverview): Promise<FieldSparkline | null> {
  const { datasourceUid } = overview.queries;
  const frames = await withRetry(() =>
    runRangeQuery('history', overview.queries.activeSeries, 24, { uid: datasourceUid, type: 'prometheus' })
  );
  return readSeries(frames, 'history');
}
