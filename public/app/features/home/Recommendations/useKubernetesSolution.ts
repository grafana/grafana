import { useAsync } from 'react-use';

import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage, usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';

import { buildKubernetesItem } from './buildKubernetesItem';
import {
  KUBERNETES_APP_ID,
  fetchClusterCpuSeries,
  fetchKubernetesHealth,
  fetchKubernetesInventory,
  resolveKubernetesDatasource,
} from './kubernetesData';
import { type ExistingSolutionProviderResult } from './types';

/**
 * Kubernetes Monitoring solution provider: reports a live item only when the app is
 * installed and accessible AND a Prometheus datasource has Kubernetes data.
 */
export function useKubernetesSolution(): ExistingSolutionProviderResult {
  const { settings, installed, loading: settingsLoading } = usePluginBridge(KUBERNETES_APP_ID);
  const enabled =
    !settingsLoading &&
    !!installed &&
    !!settings &&
    canAccessPluginPage(settings, createBridgeURL(KUBERNETES_APP_ID, '/home'));

  // react-use's useAsync has no `enabled` option: gate inside the callbacks (with
  // `enabled` in the deps) so a missing or inaccessible app never issues Kubernetes
  // queries; the effects re-run with the real fetches once the gate opens.
  //
  // The probe value is wrapped so only an enabled run can produce a defined value: on
  // the render where `enabled` flips true, useAsync still reports the disabled run's
  // settled `undefined`, which must read as loading — not as a settled empty probe.
  const probe = useAsync(
    async () => (enabled ? { datasource: await resolveKubernetesDatasource() } : undefined),
    [enabled]
  );
  const { value: inventory, loading: inventoryLoading } = useAsync(
    async () => (enabled ? fetchKubernetesInventory() : undefined),
    [enabled]
  );
  const { value: health } = useAsync(async () => (enabled ? fetchKubernetesHealth() : undefined), [enabled]);
  const { value: cpuSeries, loading: cpuLoading } = useAsync(
    async () => (enabled ? fetchClusterCpuSeries() : undefined),
    [enabled]
  );

  if (!enabled || !settings) {
    // Only bridge resolution counts as loading here — never useAsync's initial state —
    // so a missing app reports settled-empty without a skeleton flash.
    return { loading: settingsLoading, item: null };
  }

  // A rejected probe fails closed: an unusable datasource renders as no data.
  if (probe.error) {
    return { loading: false, item: null };
  }

  // Undefined covers both a probe in flight and a stale disabled-run frame; only an
  // enabled run's settled result may decide between the card and the empty state.
  if (probe.value === undefined) {
    return { loading: true, item: null };
  }

  if (probe.value.datasource === null) {
    return { loading: false, item: null };
  }

  return {
    loading: false,
    item: buildKubernetesItem(
      {
        inventory,
        inventoryLoading,
        health,
        cpuSeries: cpuSeries ?? null,
        cpuLoading,
        datasourceName: probe.value.datasource.name,
      },
      settings
    ),
  };
}
