import { type FieldSparkline, formattedValueToString, getValueFormat, locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';

import { type MetricsOverview, METRICS_DRILLDOWN_APP_ID } from './metricsData';
import { type ExistingItem } from './types';

const formatUsageNumber = getValueFormat('short');

/** Build the Metrics entry from the best available usage data. */
export function buildMetricsItem(
  overview: MetricsOverview,
  history: FieldSparkline | null,
  historyLoading = false
): ExistingItem {
  const activeSeries = t('home.recommendations.metrics.series', '{{value}} series', {
    value: formattedValueToString(formatUsageNumber(overview.activeSeries)),
  });
  const dataPointsPerMinute =
    overview.dataPointsPerMinute !== null && overview.dataPointsPerMinute > 0
      ? t('home.recommendations.metrics.data-points-per-minute', '{{value}} data points/min', {
          value: formattedValueToString(formatUsageNumber(overview.dataPointsPerMinute)),
        })
      : null;
  return {
    id: 'metrics',
    title: t('home.recommendations.metrics.title', 'Metrics & infrastructure'),
    icon: 'chart-line',
    stats: {
      primary: activeSeries,
      secondary: dataPointsPerMinute ?? undefined,
    },
    sparkline: history
      ? {
          series: history,
          caption: t('home.recommendations.metrics.active-series-24h', 'Active series · last 24h'),
        }
      : undefined,
    sparklineLoading: historyLoading,
    action: t('home.recommendations.metrics.action', 'Open metrics'),
    href: locationUtil.assureBaseUrl(createBridgeURL(METRICS_DRILLDOWN_APP_ID, '/drilldown')),
  };
}
