import { type FieldSparkline, formattedValueToString, getValueFormat, locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';

import { HOSTED_TRACES_APP_ID, LOGS_DRILLDOWN_APP_ID } from './appPluginIds';
import { type ExistingItem } from './types';

// Browser locale is the deliberate choice: the homepage number format follows the user's environment.
const compactFormatter = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

export interface LogsItemParts {
  bytes: number | null | undefined;
  sources: number | null | undefined;
  activityLoading: boolean;
  volumeSeries: FieldSparkline | null | undefined;
  datasourceName: string;
  drilldownAvailable: boolean;
}

/** Build the Hosted Logs entry from live Loki data. */
export function buildLogsItem(parts: LogsItemParts): ExistingItem {
  const { bytes, sources } = parts;
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
                ? t('home.recommendations.logs.stats-sources', '', {
                    count: sources,
                    defaultValue_one: 'ingested · 7d · {{count}} source',
                    defaultValue_other: 'ingested · 7d · {{count}} sources',
                  })
                : t('home.recommendations.logs.stats', 'ingested · 7d'),
          }
        : undefined,
    statsLoading: parts.activityLoading,
    sparkline: parts.volumeSeries
      ? {
          series: parts.volumeSeries,
          caption: t('home.recommendations.logs.volume', 'Ingest volume · last 24h'),
        }
      : undefined,
    sparklineLoading: parts.activityLoading,
    action: t('home.recommendations.logs.action', 'Open Explore (Logs)'),
    href: locationUtil.assureBaseUrl(parts.drilldownAvailable ? `/a/${LOGS_DRILLDOWN_APP_ID}` : '/explore'),
  };
}

export interface TracesItemParts {
  spans: number | null | undefined;
  services: number | null | undefined;
  activityLoading: boolean;
  throughputSeries: FieldSparkline | null | undefined;
  datasourceName: string;
  drilldownAvailable: boolean;
}

/** Build the Hosted Traces entry from live Tempo data. */
export function buildTracesItem(parts: TracesItemParts): ExistingItem {
  const { spans, services } = parts;
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
              value: compactFormatter.format(Math.ceil(spans)),
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
    statsLoading: parts.activityLoading,
    sparkline: parts.throughputSeries
      ? {
          series: parts.throughputSeries,
          caption: t('home.recommendations.traces.throughput', 'Span throughput · last 24h'),
        }
      : undefined,
    sparklineLoading: parts.activityLoading,
    action: t('home.recommendations.traces.action', 'Open Traces Drilldown'),
    href: locationUtil.assureBaseUrl(parts.drilldownAvailable ? `/a/${HOSTED_TRACES_APP_ID}` : '/explore'),
  };
}
