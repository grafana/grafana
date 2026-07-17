import { useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import { useAsync } from 'react-use';

import { formattedValueToString, getValueFormat, locationUtil, type PluginMeta } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack } from '@grafana/ui';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage, usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';

import { ExistingSolutionCard } from './ExistingSolutionCard';
import { buildKubernetesItem } from './buildKubernetesItem';
import { KUBERNETES_APP_ID } from './kubernetesData';
import {
  fetchMetricsHistory,
  fetchMetricsOverview,
  type MetricsHistory,
  type MetricsOverview,
  METRICS_DRILLDOWN_APP_ID,
} from './metricsData';
import { type ExistingItem } from './types';
import { useKubernetesCardData } from './useKubernetesCardData';

const stubbedExisting: ExistingItem[] = [
  {
    title: 'Hosted Logs',
    icon: 'file-alt',
    stats: {
      primary: '47 GB ingested',
      secondary: '8 sources',
    },
    alert: {
      primary: 'Ingest spike detected',
      details: ['checkout-service logs up 3x in the last hour'],
      action: 'View',
      href: '#',
    },
    action: 'Open Explore (Logs)',
    href: '#',
  },
];

function formatCompactUsage(value: number): string {
  const rounded = Math.ceil(value);
  const absolute = Math.abs(rounded);
  const scale = [1e12, 1e9, 1e6, 1e3].find((candidate) => absolute >= candidate) ?? 1;
  const roundedAtOneDecimal = Math.round((rounded / scale) * 10) / 10;
  const decimals = Number.isInteger(roundedAtOneDecimal) ? 0 : 1;
  return formattedValueToString(getValueFormat('count:')(rounded, decimals)).trim();
}

function buildMetricsItem(overview: MetricsOverview, history: MetricsHistory | null): ExistingItem | null {
  const activeSeries =
    overview.activeSeries !== null && overview.activeSeries > 0
      ? t('home.recommendations.metrics.series', '{{value}} series', {
          value: formatCompactUsage(overview.activeSeries),
        })
      : null;
  const dataPointsPerMinute =
    overview.dataPointsPerMinute !== null && overview.dataPointsPerMinute > 0
      ? t('home.recommendations.metrics.data-points-per-minute', '{{value}} data points/min', {
          value: formatCompactUsage(overview.dataPointsPerMinute),
        })
      : null;
  const primary = activeSeries ?? dataPointsPerMinute;
  if (!primary) {
    return null;
  }

  const bridgePath = createBridgeURL(METRICS_DRILLDOWN_APP_ID, '/drilldown');
  return {
    title: t('home.recommendations.metrics.title', 'Metrics & infrastructure'),
    icon: 'chart-line',
    stats: {
      primary,
      secondary: activeSeries ? (dataPointsPerMinute ?? undefined) : undefined,
    },
    sparkline: history
      ? {
          series: history.series,
          caption:
            history.kind === 'activeSeries'
              ? t('home.recommendations.metrics.active-series-24h', 'Active series · last 24h')
              : t('home.recommendations.metrics.data-points-per-minute-24h', 'Data points/min · last 24h'),
        }
      : undefined,
    action: t('home.recommendations.metrics.action', 'Open metrics'),
    href: locationUtil.assureBaseUrl(bridgePath),
  };
}

export function RecommendationExisting() {
  const {
    settings: kubernetesSettings,
    installed: kubernetesInstalled,
    loading: kubernetesSettingsLoading,
  } = usePluginBridge(KUBERNETES_APP_ID);
  const { settings: metricsSettings, installed: metricsInstalled, loading: metricsSettingsLoading } = usePluginBridge(
    METRICS_DRILLDOWN_APP_ID
  );
  const [selectedTitle, setSelectedTitle] = useState<string>();

  if (kubernetesSettingsLoading || metricsSettingsLoading) {
    return <RecommendationExistingSkeleton />;
  }

  const canShowKubernetes =
    kubernetesInstalled &&
    kubernetesSettings !== undefined &&
    canAccessPluginPage(kubernetesSettings, createBridgeURL(KUBERNETES_APP_ID, '/home'));
  const canShowMetrics =
    metricsInstalled &&
    metricsSettings !== undefined &&
    canAccessPluginPage(metricsSettings, createBridgeURL(METRICS_DRILLDOWN_APP_ID, '/drilldown'));

  return (
    <LiveSolutionsCard
      kubernetesSettings={kubernetesSettings}
      showKubernetes={canShowKubernetes}
      showMetrics={canShowMetrics}
      selectedTitle={selectedTitle}
      onSelect={setSelectedTitle}
    />
  );
}

interface LiveSolutionsCardProps {
  kubernetesSettings: PluginMeta<{}> | undefined;
  showKubernetes: boolean;
  showMetrics: boolean;
  selectedTitle: string | undefined;
  onSelect: (title: string) => void;
}

function LiveSolutionsCard({
  kubernetesSettings,
  showKubernetes,
  showMetrics,
  selectedTitle,
  onSelect,
}: LiveSolutionsCardProps) {
  const { datasource, resolving, resolutionError, inventory, inventoryLoading, health, cpuSeries, cpuLoading } =
    useKubernetesCardData(showKubernetes);
  const {
    value: metricsOverview,
    loading: metricsOverviewLoading,
    error: metricsOverviewError,
  } = useAsync(async () => (showMetrics ? fetchMetricsOverview() : undefined), [showMetrics]);
  const { value: metricsHistory } = useAsync(
    async () => (metricsOverview ? fetchMetricsHistory(metricsOverview) : null),
    [metricsOverview]
  );

  const metricsOverviewPending =
    showMetrics && !metricsOverviewError && (metricsOverviewLoading || metricsOverview === undefined);
  if ((showKubernetes && resolving) || metricsOverviewPending) {
    return <RecommendationExistingSkeleton />;
  }

  const kubernetesItem =
    showKubernetes && !resolutionError && datasource && kubernetesSettings
      ? buildKubernetesItem(
          {
            inventory,
            inventoryLoading,
            health,
            cpuSeries: cpuSeries ?? null,
            cpuLoading,
            datasourceName: datasource.name,
          },
          kubernetesSettings
        )
      : null;
  const metricsItem = metricsOverview ? buildMetricsItem(metricsOverview, metricsHistory ?? null) : null;

  const existing = [kubernetesItem, metricsItem, ...stubbedExisting].filter((item): item is ExistingItem => item !== null);
  const selected = existing.find((item) => item.title === selectedTitle) ?? existing[0];
  return <ExistingSolutionCard existing={existing} selected={selected} onSelect={onSelect} />;
}

// Mirrors the card body (dropdown pill, icon + title, stats, CTA) while the Kubernetes lookups
// load, so the first paint never shows a solution that a resolving fetch would replace.
function RecommendationExistingSkeleton() {
  return (
    <Stack
      direction="column"
      justifyContent="space-between"
      gap={2}
      flex={1}
      data-testid="recommendation-existing-skeleton"
    >
      <Stack direction="column" gap={1.5}>
        <Skeleton width={240} height={30} />
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Skeleton width={44} height={44} />
          <Skeleton width={200} height={24} />
        </Stack>
      </Stack>

      <Stack direction="column" gap={0}>
        <Skeleton width={140} height={35} />
        <Skeleton width={100} height={20} />
      </Stack>

      <Stack direction="row" alignItems="center">
        <Skeleton width={170} height={32} />
      </Stack>
    </Stack>
  );
}
