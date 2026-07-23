import { type FieldSparkline, type PluginMeta, locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage } from 'app/features/alerting/unified/hooks/usePluginBridge';

import {
  hasHealthProblems,
  KUBERNETES_APP_ID,
  type KubernetesHealth,
  type KubernetesInventory,
} from './kubernetesData';
import { type ExistingItem } from './types';

// Browser locale is the deliberate choice: the homepage number format follows the user's environment.
const compactFormatter = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

export interface KubernetesItemParts {
  inventory: KubernetesInventory | undefined;
  inventoryLoading: boolean;
  health: KubernetesHealth | undefined;
  cpuSeries: FieldSparkline | null | undefined;
  cpuLoading: boolean;
  datasourceName: string;
}

/** Build the Kubernetes Monitoring entry from live Prometheus data. */
export function buildKubernetesItem(parts: KubernetesItemParts, settings: PluginMeta<{}>): ExistingItem {
  const bridgePath = createBridgeURL(KUBERNETES_APP_ID, '/home');
  const href = locationUtil.assureBaseUrl(bridgePath);
  const alertsBridgePath = createBridgeURL(KUBERNETES_APP_ID, '/alerts');
  const alertsHref = canAccessPluginPage(settings, alertsBridgePath)
    ? locationUtil.assureBaseUrl(alertsBridgePath)
    : href;
  const { inventory, inventoryLoading, health, cpuSeries, cpuLoading } = parts;
  const healthRows: string[] = [];
  if (health) {
    if (health.unhealthyPods !== null && health.unhealthyPods > 0) {
      healthRows.push(
        t('home.recommendations.health.pods', '', {
          count: Math.ceil(health.unhealthyPods),
          defaultValue_one: '{{count}} pod pending or failed',
          defaultValue_other: '{{count}} pods pending or failed',
        })
      );
    }
    if (health.restarts1h !== null && health.restarts1h > 0) {
      healthRows.push(
        t('home.recommendations.health.restarts', '', {
          count: Math.ceil(health.restarts1h),
          defaultValue_one: '{{count}} restart in the last hour',
          defaultValue_other: '{{count}} restarts in the last hour',
        })
      );
    }
    if (health.notReadyNodes !== null && health.notReadyNodes > 0) {
      healthRows.push(
        t('home.recommendations.health.nodes', '', {
          count: Math.ceil(health.notReadyNodes),
          defaultValue_one: '{{count}} node not ready',
          defaultValue_other: '{{count}} nodes not ready',
        })
      );
    }
  }

  const alertsFiring = health?.alertsFiring ?? 0;
  const showAlert = health !== undefined && hasHealthProblems(health) === true;

  const clusterCount = inventory ? Math.ceil(inventory.clusters) : 0;
  const podCount = inventory ? Math.ceil(inventory.pods) : 0;
  const hasInventoryStats = inventory !== undefined && (clusterCount > 0 || podCount > 0);

  return {
    id: 'kubernetes-monitoring',
    title: t('home.recommendations.kubernetes.title', 'Kubernetes Monitoring'),
    icon: 'kubernetes',
    subtitle: t('home.recommendations.kubernetes.datasource', 'via {{name}}', { name: parts.datasourceName }),
    stats: hasInventoryStats
      ? {
          primary: t('home.recommendations.kubernetes.clusters', '', {
            count: clusterCount,
            value: compactFormatter.format(clusterCount),
            defaultValue_one: '{{value}} cluster',
            defaultValue_other: '{{value}} clusters',
          }),
          secondary: t('home.recommendations.kubernetes.pods', '', {
            count: podCount,
            value: compactFormatter.format(podCount),
            defaultValue_one: '{{value}} pod',
            defaultValue_other: '{{value}} pods',
          }),
        }
      : undefined,
    statsLoading: inventoryLoading,
    sparkline: cpuSeries
      ? {
          series: cpuSeries,
          caption: t('home.recommendations.kubernetes.cluster-cpu', 'Cluster CPU · last 24h'),
        }
      : undefined,
    sparklineLoading: cpuLoading,
    alert: showAlert
      ? {
          primary:
            alertsFiring > 0
              ? t('home.recommendations.kubernetes.alerts-firing', '', {
                  count: Math.ceil(alertsFiring),
                  value: compactFormatter.format(Math.ceil(alertsFiring)),
                  defaultValue_one: '{{value}} alert firing',
                  defaultValue_other: '{{value}} alerts firing',
                })
              : healthRows[0],
          details: alertsFiring > 0 ? healthRows : healthRows.slice(1),
          action: t('home.recommendations.kubernetes.view', 'View'),
          href: alertsHref,
        }
      : undefined,
    action: t('home.recommendations.kubernetes.action', 'Open K8s app'),
    href,
  };
}
