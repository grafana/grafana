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
import { type KubernetesFilterSelection, kubernetesFilterValuesFor } from './kubernetesFilters';
import { accessibleAppPage, openAppLabel, openExploreLabel } from './pluginPages';
import { datasourceFact } from './probeUtils';
import { solutionOffer } from './solutionOffer';
import { detectSignal, type SignalDetection } from './solutionState';
import { type Solution } from './types';

const formatUsageNumber = getValueFormat('short');

/** Filter-independent detection; the owner memoizes it so the TTL-cached probe still re-resolves per visit. */
export const kubernetesSignal = () => detectSignal(resolveKubernetesDatasource);

async function accessibleAppHref(path: string, ds: DataSourceInstanceListItem): Promise<string | null> {
  const bridgePath = await accessibleAppPage(KUBERNETES_APP_ID, path);
  return bridgePath ? locationUtil.assureBaseUrl(`${bridgePath}?var-datasource=${encodeURIComponent(ds.name)}`) : null;
}

function buildHealthRows(health: KubernetesHealth): string[] {
  const rows: string[] = [];
  if (health.pendingPods > 0) {
    rows.push(
      t('home.solutions.kubernetes.health-pending', '', {
        count: Math.ceil(health.pendingPods),
        defaultValue_one: '{{count}} pod stuck pending',
        defaultValue_other: '{{count}} pods stuck pending',
      })
    );
  }
  if (health.crashLoopingPods > 0) {
    rows.push(
      t('home.solutions.kubernetes.health-crashloop', '', {
        count: Math.ceil(health.crashLoopingPods),
        defaultValue_one: '{{count}} pod crash looping',
        defaultValue_other: '{{count}} pods crash looping',
      })
    );
  }
  if (health.notReadyNodes > 0) {
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
 * Every fact reads the one `selection` snapshot; the homepage builds a new instance when it
 * changes. The saved values scope only the datasource they were picked from: any other resolved
 * datasource reads unscoped. The homepage passes the detector it also feeds the recommendations
 * snapshot, so the card and the snapshot agree on the datasource for the whole visit, however
 * often the instance is rebuilt; a standalone instance detects on its own.
 */
export function kubernetesSolution(
  selection: KubernetesFilterSelection | null = null,
  detect: () => Promise<SignalDetection> = memoize(kubernetesSignal)
): Solution {
  const datasource = async () => (await detect()).datasource;
  const scoped = (ds: DataSourceInstanceListItem) => kubernetesFilterValuesFor(selection, ds.uid);

  const inventory = datasourceFact(datasource, (ds) => fetchKubernetesInventory(ds, scoped(ds)));
  const health = datasourceFact(datasource, (ds) => fetchKubernetesHealth(ds, scoped(ds)));
  const sparkline = datasourceFact(datasource, async (ds) => {
    const scope = scoped(ds);
    const series = await fetchClusterCpuSeries(ds, scope);
    if (!series) {
      return null;
    }
    // A scoped series must not be captioned "Cluster CPU"; nodes are the narrower scope, so
    // they win the caption when both filters are set.
    const caption = scope.nodes?.length
      ? t('home.solutions.kubernetes.node-cpu', 'Node CPU · last 24h')
      : scope.namespaces?.length
        ? t('home.solutions.kubernetes.namespace-cpu', 'Namespace CPU · last 24h')
        : t('home.solutions.kubernetes.cluster-cpu', 'Cluster CPU · last 24h');
    return { series, caption };
  });
  const alert = memoize(async () => {
    const status = await health();
    if (!status || !hasHealthProblems(status)) {
      return null;
    }

    const healthRows = buildHealthRows(status);
    const alertsFiring = status.alertsFiring;
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
    return status !== null && hasHealthProblems(status);
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
      // Zero is an answer: nothing matched the user's scope (or the cluster went quiet), which
      // reads clearer than an empty card.
      const clusterCount = Math.ceil(counts.clusters);
      const podCount = Math.ceil(counts.pods);
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
    sparkline,
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
