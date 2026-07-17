import { type DataSourceInstanceListItem, type FieldSparkline } from '@grafana/data';
import { getDataSourceInstanceList, getDataSourceInstanceSettings } from '@grafana/runtime/unstable';

import { readScalar, readSeries, runInstantQueries, runRangeQuery } from './promQuery';

/** Grafana Metrics Drilldown app plugin ID. @lintignore */
export const METRICS_DRILLDOWN_APP_ID = 'grafana-metricsdrilldown-app';

export interface MetricsOverview {
  activeSeries: number | null;
  activeSeriesSource?: 'cloud' | 'oss';
  dataPointsPerMinute: number | null;
  datasourceUid?: string;
}

export interface MetricsHistory {
  series: FieldSparkline;
  kind: 'activeSeries' | 'dataPointsPerMinute';
}

const CLOUD_USAGE_DATASOURCE = 'grafanacloud-usage';

const CLOUD_OVERVIEW_QUERIES: Record<string, string> = {
  activeSeries: 'sum(grafanacloud_instance_active_series)',
  dataPointsPerMinute: '60 * sum(grafanacloud_instance_samples_per_second)',
};

const OSS_DATA_POINTS_PER_MINUTE_QUERY = '60 * sum(rate(prometheus_tsdb_head_samples_appended_total[5m]))';
const OSS_ACTIVE_SERIES_QUERY = 'sum(prometheus_tsdb_head_series)';

function isCloudUtilityDatasource(ds: DataSourceInstanceListItem): boolean {
  return (
    ds.name === CLOUD_USAGE_DATASOURCE || ds.uid === CLOUD_USAGE_DATASOURCE || ds.name === 'grafanacloud-ml-metrics'
  );
}

async function listPrometheusDatasources(): Promise<DataSourceInstanceListItem[]> {
  return getDataSourceInstanceList({
    type: 'prometheus',
    filter: (ds) => ds.meta.id !== 'grafana',
  });
}

function findCloudUsageDatasource(list: DataSourceInstanceListItem[]): DataSourceInstanceListItem | undefined {
  return list.find((ds) => ds.name === CLOUD_USAGE_DATASOURCE || ds.uid === CLOUD_USAGE_DATASOURCE);
}

async function getPrimaryOssDatasource(list: DataSourceInstanceListItem[]): Promise<DataSourceInstanceListItem | undefined> {
  const candidates = getOssDatasources(list);
  try {
    const selected = await getDataSourceInstanceSettings({ type: 'prometheus' });
    return candidates.find((ds) => ds.uid === selected?.uid) ?? candidates[0];
  } catch {
    return candidates[0];
  }
}

function getOssDatasources(list: DataSourceInstanceListItem[]): DataSourceInstanceListItem[] {
  return list.filter((ds) => !isCloudUtilityDatasource(ds));
}

async function fetchCloudOverview(datasource: DataSourceInstanceListItem): Promise<MetricsOverview | null> {
  try {
    const frames = await runInstantQueries(CLOUD_OVERVIEW_QUERIES, datasource);
    const activeSeries = readScalar(frames, 'activeSeries');
    const dataPointsPerMinute = readScalar(frames, 'dataPointsPerMinute');
    return activeSeries !== null && activeSeries > 0
      ? { activeSeries, activeSeriesSource: 'cloud', dataPointsPerMinute }
      : null;
  } catch {
    return null;
  }
}

async function fetchOssOverview(datasources: DataSourceInstanceListItem[]): Promise<MetricsOverview | null> {
  const datasource = await getPrimaryOssDatasource(datasources);
  if (!datasource) {
    return null;
  }

  let activeSeries: number | null = null;
  let dataPointsPerMinute: number | null = null;
  try {
    const frames = await runInstantQueries(
      { activeSeries: OSS_ACTIVE_SERIES_QUERY, dataPointsPerMinute: OSS_DATA_POINTS_PER_MINUTE_QUERY },
      datasource
    );
    activeSeries = readScalar(frames, 'activeSeries');
    dataPointsPerMinute = readScalar(frames, 'dataPointsPerMinute');
  } catch {
    // Most Prometheus-compatible backends do not expose Prometheus's self-monitoring metrics.
  }
  if ((activeSeries ?? 0) <= 0 && dataPointsPerMinute === null) {
    return null;
  }

  return {
    activeSeries: activeSeries !== null && activeSeries > 0 ? activeSeries : null,
    ...(activeSeries !== null && activeSeries > 0 ? { activeSeriesSource: 'oss' as const } : {}),
    dataPointsPerMinute,
    datasourceUid: datasource.uid,
  };
}

/** Best available Metrics usage summary: Grafana Cloud usage first, then a Prometheus datasource. */
export async function fetchMetricsOverview(): Promise<MetricsOverview | null> {
  try {
    const datasources = await listPrometheusDatasources();
    const cloudUsage = findCloudUsageDatasource(datasources);
    const cloudOverview = cloudUsage ? await fetchCloudOverview(cloudUsage) : null;
    if (cloudOverview) {
      return cloudOverview;
    }
    return await fetchOssOverview(datasources);
  } catch {
    return null;
  }
}

/** Best available history for the summary: 24h active series or data points per minute. */
export async function fetchMetricsHistory(overview: MetricsOverview): Promise<MetricsHistory | null> {
  try {
    if (overview.activeSeries !== null) {
      if (overview.activeSeriesSource === 'oss') {
        if (!overview.datasourceUid) {
          return null;
        }
        const frames = await runRangeQuery('activeSeries', OSS_ACTIVE_SERIES_QUERY, 24, {
          uid: overview.datasourceUid,
          type: 'prometheus',
        });
        const series = readSeries(frames, 'activeSeries');
        return series ? { series, kind: 'activeSeries' } : null;
      }

      const datasource = findCloudUsageDatasource(await listPrometheusDatasources());
      if (!datasource) {
        return null;
      }
      const frames = await runRangeQuery('activeSeries', CLOUD_OVERVIEW_QUERIES.activeSeries, 24, datasource);
      const series = readSeries(frames, 'activeSeries');
      return series ? { series, kind: 'activeSeries' } : null;
    }

    if (!overview.datasourceUid || overview.dataPointsPerMinute === null) {
      return null;
    }
    const frames = await runRangeQuery('dataPointsPerMinute', OSS_DATA_POINTS_PER_MINUTE_QUERY, 24, {
      uid: overview.datasourceUid,
      type: 'prometheus',
    });
    const series = readSeries(frames, 'dataPointsPerMinute');
    return series ? { series, kind: 'dataPointsPerMinute' } : null;
  } catch {
    return null;
  }
}
