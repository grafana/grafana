import { t } from '@grafana/i18n';
import { type DataQuery } from '@grafana/schema';

import { buildExploreHref } from './exploreLink';
import { compactFormatter } from './formatters';
import { type SpanRateResult, TRACES_ERROR_MIN_RATE } from './tracesData';
import { type ExistingItem } from './types';

// The CTA and alert both land in Explore over the last hour — the "what is happening now" window.
const EXPLORE_RANGE = { from: 'now-1h', to: 'now' };

export interface TracesItemParts {
  serviceCount: number | undefined;
  servicesLoading: boolean;
  spanRate: SpanRateResult | undefined;
  spanRateLoading: boolean;
  topErrorService: { service: string; rate: number } | null | undefined;
  datasourceUid: string;
  datasourceName: string;
}

// The Tempo query model the Explore pane expects; there is no in-repo tempo frontend to import from.
interface TempoExploreQuery extends DataQuery {
  query: string;
}

/** Build the Hosted Traces entry from live Tempo data. */
export function buildTracesItem(parts: TracesItemParts): ExistingItem {
  const { serviceCount, servicesLoading, spanRate, spanRateLoading, topErrorService, datasourceUid, datasourceName } =
    parts;

  const traceqlQueries = (query: string): TempoExploreQuery[] => [
    { refId: 'A', queryType: 'traceql', query, datasource: { type: 'tempo', uid: datasourceUid } },
  ];

  const errorRate = spanRate?.errorRate ?? null;

  return {
    title: t('home.recommendations.traces.title', 'Hosted Traces'),
    icon: 'gf-traces',
    subtitle: t('home.recommendations.traces.datasource', 'via {{name}}', { name: datasourceName }),
    stats:
      serviceCount !== undefined && serviceCount > 0
        ? {
            primary: compactFormatter.format(serviceCount),
            secondary: t('home.recommendations.traces.services', '', {
              count: serviceCount,
              defaultValue_one: 'service sending traces',
              defaultValue_other: 'services sending traces',
            }),
          }
        : undefined,
    statsLoading: servicesLoading,
    sparkline: spanRate?.series
      ? {
          series: spanRate.series,
          caption: t('home.recommendations.traces.span-rate', 'Span rate · last 3h'),
        }
      : undefined,
    sparklineLoading: spanRateLoading,
    alert:
      errorRate !== null && errorRate >= TRACES_ERROR_MIN_RATE
        ? {
            primary: t('home.recommendations.traces.errors', '≈{{value}} error spans/s', {
              value: compactFormatter.format(Math.round(errorRate)),
            }),
            details: topErrorService
              ? [
                  t('home.recommendations.traces.errors-detail', '{{service}} leads at {{value}}/s in the last hour', {
                    service: topErrorService.service,
                    value: compactFormatter.format(topErrorService.rate),
                  }),
                ]
              : undefined,
            action: t('home.recommendations.traces.view', 'View'),
            href: buildExploreHref(datasourceUid, traceqlQueries('{status=error}'), EXPLORE_RANGE),
          }
        : undefined,
    action: t('home.recommendations.traces.action', 'Open Explore (Traces)'),
    href: buildExploreHref(datasourceUid, traceqlQueries('{}'), EXPLORE_RANGE),
  };
}
