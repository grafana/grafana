import { type FieldSparkline, formattedValueToString, getValueFormat, locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { constructDataSourceExploreUrl } from 'app/features/datasources/utils';

import { HOSTED_TRACES_APP_ID, LOGS_DRILLDOWN_APP_ID, METRICS_DRILLDOWN_APP_ID } from './appPluginIds';
import { type MetricsDiskPressure } from './telemetryData';
import { type ExistingItem } from './types';

const formatUsageNumber = getValueFormat('short');

export interface LogsItemParts {
  bytes: number | null;
  sources: number | null;
  volumeSeries: FieldSparkline | null;
  datasourceName: string;
  drilldownAvailable: boolean;
}

/** Build the Hosted Logs entry from live Loki data; the caller guarantees something to show. */
export function buildLogsItem(parts: LogsItemParts): ExistingItem {
  const { bytes, sources } = parts;
  const drilldown = parts.drilldownAvailable;
  return {
    id: 'logs',
    title: t('home.recommendations.logs.title', 'Hosted Logs'),
    icon: 'gf-logs',
    subtitle: t('home.recommendations.logs.datasource', 'via {{name}}', { name: parts.datasourceName }),
    stats:
      bytes != null
        ? {
            primary: formattedValueToString(getValueFormat('decbytes')(bytes)),
            secondary:
              sources != null
                ? // '~': Loki label-values may scan a wider window than requested, so the count can
                  // include stale sources.
                  t('home.recommendations.logs.stats-sources', '', {
                    count: sources,
                    defaultValue_one: 'ingested · 7d · ~{{count}} source',
                    defaultValue_other: 'ingested · 7d · ~{{count}} sources',
                  })
                : t('home.recommendations.logs.stats', 'ingested · 7d'),
          }
        : undefined,
    sparkline: parts.volumeSeries
      ? {
          series: parts.volumeSeries,
          caption: t('home.recommendations.logs.volume', 'Ingest volume · last 24h'),
        }
      : undefined,
    action: drilldown
      ? t('home.recommendations.logs.action', 'Open Explore (Logs)')
      : t('home.recommendations.logs.action-explore', 'Open in Explore'),
    href: drilldown
      ? locationUtil.assureBaseUrl(`/a/${LOGS_DRILLDOWN_APP_ID}`)
      : constructDataSourceExploreUrl({ name: parts.datasourceName }),
  };
}

export interface TracesItemParts {
  spans: number | null;
  services: number | null;
  throughputSeries: FieldSparkline | null;
  datasourceName: string;
  drilldownAvailable: boolean;
}

/** Build the Hosted Traces entry from live Tempo data; the caller guarantees something to show. */
export function buildTracesItem(parts: TracesItemParts): ExistingItem {
  const { spans, services } = parts;
  const drilldown = parts.drilldownAvailable;
  return {
    id: 'traces',
    title: t('home.recommendations.traces.title', 'Hosted Traces'),
    icon: 'gf-traces',
    subtitle: t('home.recommendations.traces.datasource', 'via {{name}}', { name: parts.datasourceName }),
    stats:
      spans != null
        ? {
            primary: t('home.recommendations.traces.spans', '', {
              count: Math.ceil(spans),
              value: formattedValueToString(formatUsageNumber(Math.ceil(spans))),
              defaultValue_one: '{{value}} span',
              defaultValue_other: '{{value}} spans',
            }),
            secondary:
              services != null
                ? t('home.recommendations.traces.stats-services', '', {
                    count: services,
                    defaultValue_one: 'traced · 24h · {{count}} service',
                    defaultValue_other: 'traced · 24h · {{count}} services',
                  })
                : t('home.recommendations.traces.stats', 'traced · 24h'),
          }
        : undefined,
    sparkline: parts.throughputSeries
      ? {
          series: parts.throughputSeries,
          caption: t('home.recommendations.traces.throughput', 'Span throughput · last 24h'),
        }
      : undefined,
    action: drilldown
      ? t('home.recommendations.traces.action', 'Open Traces Drilldown')
      : t('home.recommendations.traces.action-explore', 'Open in Explore'),
    href: drilldown
      ? locationUtil.assureBaseUrl(`/a/${HOSTED_TRACES_APP_ID}`)
      : constructDataSourceExploreUrl({ name: parts.datasourceName }),
  };
}

export interface MetricsItemParts {
  series: number | null;
  dataPointsPerMinute: number | null;
  names: number | null;
  hosts: number | null;
  seriesSparkline: FieldSparkline | null;
  disk: MetricsDiskPressure | null;
  datasourceName: string;
  drilldownAvailable: boolean;
}

/** Build the Metrics & infrastructure entry from live Prometheus data; the caller guarantees something to show. */
export function buildMetricsItem(parts: MetricsItemParts): ExistingItem {
  const { series, names, hosts, disk } = parts;
  const drilldown = parts.drilldownAvailable;
  const secondary =
    parts.dataPointsPerMinute != null
      ? t('home.recommendations.metrics.data-points-per-minute', '{{value}} data points/min', {
          value: formattedValueToString(formatUsageNumber(Math.ceil(parts.dataPointsPerMinute))),
        })
      : hosts != null
        ? t('home.recommendations.metrics.stats-hosts', '', {
            count: hosts,
            defaultValue_one: 'active · {{count}} host',
            defaultValue_other: 'active · {{count}} hosts',
          })
        : t('home.recommendations.metrics.stats', 'active');
  let stats: ExistingItem['stats'];
  if (series != null) {
    stats = {
      primary: t('home.recommendations.metrics.series', '', {
        count: Math.ceil(series),
        value: formattedValueToString(formatUsageNumber(Math.ceil(series))),
        defaultValue_one: '{{value}} series',
        defaultValue_other: '{{value}} series',
      }),
      secondary,
    };
  } else if (names != null) {
    // Fallback primary: the distinct-name count when no active-series source responded.
    stats = {
      primary: t('home.recommendations.metrics.names', '', {
        count: Math.ceil(names),
        value: formattedValueToString(formatUsageNumber(Math.ceil(names))),
        defaultValue_one: '{{value}} metric',
        defaultValue_other: '{{value}} metrics',
      }),
      secondary,
    };
  }
  const alertDetails: string[] = [];
  if (disk?.worstInstance && disk.worstRatio != null) {
    alertDetails.push(
      t('home.recommendations.metrics.disk-worst', '{{host}} at {{percent}}%', {
        // The design shows the bare host ("web-03"), not the scrape target ("web-03:9100").
        host: disk.worstInstance.replace(/:\d+$/, ''),
        percent: Math.round(disk.worstRatio * 100),
      })
    );
  }
  if (disk?.hoursToFull != null) {
    alertDetails.push(
      t('home.recommendations.metrics.disk-eta', '', {
        count: Math.round(disk.hoursToFull),
        defaultValue_one: '~{{count}} h to full',
        defaultValue_other: '~{{count}} h to full',
      })
    );
  }
  return {
    id: 'metrics',
    title: t('home.recommendations.metrics.title', 'Metrics & infrastructure'),
    icon: 'chart-line',
    subtitle: t('home.recommendations.metrics.datasource', 'via {{name}}', { name: parts.datasourceName }),
    stats,
    sparkline: parts.seriesSparkline
      ? {
          series: parts.seriesSparkline,
          caption: t('home.recommendations.metrics.series-trend', 'Active series · last 24h'),
        }
      : undefined,
    alert:
      disk != null && disk.hostsAbove > 0
        ? {
            primary: t('home.recommendations.metrics.disk-hosts', '', {
              count: disk.hostsAbove,
              defaultValue_one: '{{count}} host above 90% disk',
              defaultValue_other: '{{count}} hosts above 90% disk',
            }),
            details: alertDetails,
            action: t('home.recommendations.metrics.view', 'View'),
            // No app route exists for host disk detail; Explore with the datasource preselected.
            href: constructDataSourceExploreUrl({ name: parts.datasourceName }),
          }
        : undefined,
    action: drilldown
      ? t('home.recommendations.metrics.action', 'Open Metrics Drilldown')
      : t('home.recommendations.metrics.action-explore', 'Open in Explore'),
    href: drilldown
      ? locationUtil.assureBaseUrl(`/a/${METRICS_DRILLDOWN_APP_ID}`)
      : constructDataSourceExploreUrl({ name: parts.datasourceName }),
  };
}
