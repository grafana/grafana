import memoize from 'micro-memoize';

import { formattedValueToString, getValueFormat, locationUtil, type DataSourceInstanceListItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { constructDataSourceExploreUrl } from 'app/features/datasources/utils';

import { KubernetesFiltersButton } from './KubernetesFiltersButton';
import {
  fetchClusterCpuSeries,
  fetchKubernetesHealth,
  fetchKubernetesInventory,
  resolveKubernetesDatasource,
  hasHealthProblems,
  KUBERNETES_APP_ID,
  type KubernetesHealth,
} from './kubernetesData';
import { getKubernetesFilters, type KubernetesHomeFilters } from './kubernetesFilters';
import { accessibleAppPage, openAppLabel, openExploreLabel } from './pluginPages';
import { datasourceFact } from './probeUtils';
import { solutionOffer } from './solutionOffer';
import { detectSignal } from './solutionState';
import { type Solution } from './types';

const formatUsageNumber = getValueFormat('short');

/** Filter-independent detection; callers memoize per consumer so the TTL-cached probe still re-resolves. */
export const kubernetesSignal = () => detectSignal(resolveKubernetesDatasource);

async function accessibleAppHref(path: string, ds: DataSourceInstanceListItem): Promise<string | null> {
  const bridgePath = await accessibleAppPage(KUBERNETES_APP_ID, path);
  return bridgePath ? locationUtil.assureBaseUrl(`${bridgePath}?var-datasource=${encodeURIComponent(ds.name)}`) : null;
}

function buildHealthRows(health: KubernetesHealth): string[] {
  const rows: string[] = [];
  if (health.unhealthyPods !== null && health.unhealthyPods > 0) {
    rows.push(
      t('home.solutions.kubernetes.health-pods', '', {
        count: Math.ceil(health.unhealthyPods),
        defaultValue_one: '{{count}} pod pending or failed',
        defaultValue_other: '{{count}} pods pending or failed',
      })
    );
  }
  if (health.restarts1h !== null && health.restarts1h > 0) {
    rows.push(
      t('home.solutions.kubernetes.health-restarts', '', {
        count: Math.ceil(health.restarts1h),
        defaultValue_one: '{{count}} restart in the last hour',
        defaultValue_other: '{{count}} restarts in the last hour',
      })
    );
  }
  if (health.notReadyNodes !== null && health.notReadyNodes > 0) {
    rows.push(
      t('home.solutions.kubernetes.health-nodes', '', {
        count: Math.ceil(health.notReadyNodes),
        defaultValue_one: '{{count}} node not ready',
        defaultValue_other: '{{count}} nodes not ready',
      })
    );
  }
  return rows;
}

/**
 * `loadFilters` is read lazily and once per instance, so every fact of this instance queries one
 * filter snapshot; the homepage rebuilds the instance when the persisted filters change.
 */
export function kubernetesSolution(loadFilters: () => Promise<KubernetesHomeFilters> = getKubernetesFilters): Solution {
  const detect = memoize(kubernetesSignal);
  const datasource = async () => (await detect()).datasource;
  const filters = memoize(loadFilters);
  const scoped =
    <T>(fetch: (ds: DataSourceInstanceListItem, filters: KubernetesHomeFilters) => Promise<T>) =>
    async (ds: DataSourceInstanceListItem) =>
      fetch(ds, await filters());

  const inventory = datasourceFact(datasource, scoped(fetchKubernetesInventory));
  const health = datasourceFact(datasource, scoped(fetchKubernetesHealth));
  const clusterCpu = datasourceFact(datasource, scoped(fetchClusterCpuSeries));
  const alert = memoize(async () => {
    const status = await health();
    if (!status || hasHealthProblems(status) !== true) {
      return null;
    }

    const healthRows = buildHealthRows(status);
    const alertsFiring = status.alertsFiring ?? 0;
    return {
      primary:
        alertsFiring > 0
          ? t('home.solutions.kubernetes.alerts-firing', '', {
              count: Math.ceil(alertsFiring),
              value: formattedValueToString(formatUsageNumber(Math.ceil(alertsFiring))),
              defaultValue_one: '{{value}} alert firing',
              defaultValue_other: '{{value}} alerts firing',
            })
          : healthRows[0],
      details: alertsFiring > 0 ? healthRows : healthRows.slice(1),
    };
  });

  const signal = async () => (await detect()).status;
  const needsAttention = async () => {
    const status = await health();
    return status !== null && hasHealthProblems(status) === true;
  };

  return {
    id: 'kubernetes',
    icon: 'kubernetes',
    title: t('home.solutions.kubernetes.title', 'Kubernetes Monitoring'),
    customize: KubernetesFiltersButton,
    signal,
    datasource,
    needsAttention,
    offer: solutionOffer(signal, {
      appId: KUBERNETES_APP_ID,
      description: t(
        'home.solutions.kubernetes.description',
        'See cluster health, cost, and right-sizing savings in one view.'
      ),
      setupHint: t('home.solutions.kubernetes.setup-hint', '~3 min · Helm/Alloy'),
      setupCta: async () => {
        // Hide setup when this user cannot open the destination.
        const page = await accessibleAppPage(KUBERNETES_APP_ID, '/configuration/cluster-config');
        return page
          ? {
              label: t('home.solutions.cta.set-up', 'Set up'),
              href: locationUtil.assureBaseUrl(page),
              action: 'setup',
            }
          : null;
      },
    }),
    refinedStats: async () => null,
    alert,
    stats: async () => {
      const counts = await inventory();
      if (!counts) {
        return null;
      }
      const clusterCount = Math.ceil(counts.clusters);
      const podCount = Math.ceil(counts.pods);
      if (clusterCount <= 0 && podCount <= 0) {
        return null;
      }
      return {
        primary: t('home.solutions.kubernetes.clusters', '', {
          count: clusterCount,
          value: formattedValueToString(formatUsageNumber(clusterCount)),
          defaultValue_one: '{{value}} cluster',
          defaultValue_other: '{{value}} clusters',
        }),
        secondary: t('home.solutions.kubernetes.pods', '', {
          count: podCount,
          value: formattedValueToString(formatUsageNumber(podCount)),
          defaultValue_one: '{{value}} pod',
          defaultValue_other: '{{value}} pods',
        }),
      };
    },
    sparkline: async () => {
      const series = await clusterCpu();
      if (!series) {
        return null;
      }
      // A scoped series must not be captioned "Cluster CPU"; nodes are the narrower scope, so
      // they win the caption when both filters are set.
      const { namespaces, nodes } = await filters();
      const caption = nodes?.length
        ? t('home.solutions.kubernetes.node-cpu', 'Node CPU · last 24h')
        : namespaces?.length
          ? t('home.solutions.kubernetes.namespace-cpu', 'Namespace CPU · last 24h')
          : t('home.solutions.kubernetes.cluster-cpu', 'Cluster CPU · last 24h');
      return { series, caption };
    },
    cta: async () => {
      const ds = await datasource();
      if (!ds) {
        return null;
      }
      if (await needsAttention().catch(() => false)) {
        const alertsHref = await accessibleAppHref('/alerts', ds);
        if (alertsHref) {
          return {
            label: t('home.solutions.kubernetes.view-alerts', 'View alerts in Kubernetes Monitoring'),
            href: alertsHref,
            action: 'view_alerts',
          };
        }
      }
      const href = await accessibleAppHref('/home', ds);
      return href
        ? { label: openAppLabel('Kubernetes Monitoring'), href, action: 'open_solution' }
        : {
            label: openExploreLabel(),
            href: constructDataSourceExploreUrl({ name: ds.name }),
            action: 'open_solution',
          };
    },
  };
}
