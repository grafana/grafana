import Skeleton from 'react-loading-skeleton';

import { Stack } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage, usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { AccessControlAction } from 'app/types/accessControl';

import { buildKubernetesItem } from './buildKubernetesItem';
import { buildLogsItem } from './buildLogsItem';
import { buildTracesItem } from './buildTracesItem';
import { KUBERNETES_APP_ID } from './kubernetesData';
import { type ExistingItem } from './types';
import { useKubernetesCardData } from './useKubernetesCardData';
import { useLogsCardData } from './useLogsCardData';
import { useTracesCardData } from './useTracesCardData';

/**
 * Live "Enabled solution" entries (Kubernetes, Logs, Traces) in fixed order, plus a single loading
 * flag: while any resolution is pending the first paint must not show a solution set that a
 * still-resolving fetch would replace.
 */
export function useExistingSolutions(): { items: ExistingItem[]; loading: boolean } {
  const { settings, installed, loading: settingsLoading } = usePluginBridge(KUBERNETES_APP_ID);
  const bridgePath = createBridgeURL(KUBERNETES_APP_ID, '/home');
  const k8sEnabled = Boolean(installed && settings && canAccessPluginPage(settings, bridgePath));

  // Hooks are always called — gating happens inside via `enabled` / null resolutions.
  const k8s = useKubernetesCardData(k8sEnabled);
  const logs = useLogsCardData();
  const traces = useTracesCardData();

  // The Logs/Traces CTAs are Explore links — useless without permission to run Explore queries.
  const canExplore = contextSrv.hasPermission(AccessControlAction.DataSourcesExplore);

  const kubernetesItem =
    k8sEnabled && settings && !k8s.resolutionError && k8s.datasource
      ? buildKubernetesItem(
          {
            inventory: k8s.inventory,
            inventoryLoading: k8s.inventoryLoading,
            health: k8s.health,
            cpuSeries: k8s.cpuSeries ?? null,
            cpuLoading: k8s.cpuLoading,
            datasourceName: k8s.datasource.name,
          },
          settings
        )
      : null;

  const logsItem =
    canExplore && !logs.resolutionError && logs.resolution
      ? buildLogsItem({
          stats: logs.stats,
          statsLoading: logs.statsLoading,
          volume: logs.volume,
          volumeLoading: logs.volumeLoading,
          datasourceUid: logs.resolution.ds.uid,
          datasourceName: logs.resolution.ds.name,
          sourceLabel: logs.resolution.sourceLabel,
        })
      : null;

  const tracesItem =
    canExplore && !traces.resolutionError && traces.resolution
      ? buildTracesItem({
          serviceCount: traces.serviceCount,
          servicesLoading: traces.servicesLoading,
          spanRate: traces.spanRate,
          spanRateLoading: traces.spanRateLoading,
          topErrorService: traces.topErrorService,
          datasourceUid: traces.resolution.ds.uid,
          datasourceName: traces.resolution.ds.name,
        })
      : null;

  const loading = settingsLoading || k8s.resolving || logs.resolving || traces.resolving;
  const items = [kubernetesItem, logsItem, tracesItem].filter((item) => item !== null);
  return { items, loading };
}

// Mirrors the card body (dropdown pill, icon + title, stats, CTA) while the solution lookups
// load, so the first paint never shows a solution that a resolving fetch would replace.
export function RecommendationExistingSkeleton() {
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
