import { t } from '@grafana/i18n';
import { type DataQuery } from '@grafana/schema';

import { buildExploreHref } from './exploreLink';
import { compactFormatter, formatBytesCompact } from './formatters';
import { type LogsSourceLabel, type LogsStats, type LogsVolume } from './logsData';
import { type ExistingItem } from './types';

// The CTA and alert both land in Explore over the last hour — the "what is happening now" window.
const EXPLORE_RANGE = { from: 'now-1h', to: 'now' };

// LogQL string-literal escaping: backslashes first, then quotes.
const escapeLogQL = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

export interface LogsItemParts {
  stats: LogsStats | undefined;
  statsLoading: boolean;
  volume: LogsVolume | undefined;
  volumeLoading: boolean;
  datasourceUid: string;
  datasourceName: string;
  sourceLabel: LogsSourceLabel;
}

// The Loki query model the Explore pane expects; the loki plugin's own types live in a separate workspace.
interface LokiExploreQuery extends DataQuery {
  expr: string;
}

/** Build the Hosted Logs entry from live Loki data. */
export function buildLogsItem(parts: LogsItemParts): ExistingItem {
  const { stats, statsLoading, volume, volumeLoading, datasourceUid, datasourceName, sourceLabel } = parts;

  const lokiQueries = (expr: string): LokiExploreQuery[] => [
    { refId: 'A', expr, datasource: { type: 'loki', uid: datasourceUid } },
  ];

  const bytes7d = stats?.bytes7d ?? 0;
  const sources7d = stats?.sources7d ?? 0;
  const spike = volume?.spike ?? null;
  const series = volume?.series ?? null;

  return {
    title: t('home.recommendations.logs.title', 'Hosted Logs'),
    icon: 'gf-logs',
    subtitle: t('home.recommendations.logs.datasource', 'via {{name}}', { name: datasourceName }),
    stats:
      stats !== undefined && bytes7d > 0
        ? {
            primary: formatBytesCompact(bytes7d),
            secondary:
              sources7d > 0
                ? t('home.recommendations.logs.ingested', '', {
                    count: sources7d,
                    value: compactFormatter.format(sources7d),
                    defaultValue_one: 'ingested · 7d · {{value}} source',
                    defaultValue_other: 'ingested · 7d · {{value}} sources',
                  })
                : t('home.recommendations.logs.ingested-nosources', 'ingested · 7d'),
          }
        : undefined,
    statsLoading,
    sparkline: series
      ? {
          series,
          caption: t('home.recommendations.logs.ingest-volume', 'Ingest volume · last 24h'),
        }
      : undefined,
    sparklineLoading: volumeLoading,
    alert: spike
      ? {
          primary: t('home.recommendations.logs.spike', 'Ingest spike detected'),
          details: [
            t('home.recommendations.logs.spike-detail', '{{source}} logs up {{ratio}}× in the last hour', {
              source: spike.source,
              ratio: spike.ratio,
            }),
          ],
          action: t('home.recommendations.logs.view', 'View'),
          href: buildExploreHref(
            datasourceUid,
            lokiQueries(`{${sourceLabel}="${escapeLogQL(spike.source)}"}`),
            EXPLORE_RANGE
          ),
        }
      : undefined,
    action: t('home.recommendations.logs.action', 'Open Explore (Logs)'),
    href: buildExploreHref(datasourceUid, lokiQueries(`{${sourceLabel}=~".+"}`), EXPLORE_RANGE),
  };
}
