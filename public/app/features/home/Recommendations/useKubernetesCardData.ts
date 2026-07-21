import { useAsync } from 'react-use';

import {
  fetchClusterCpuSeries,
  fetchKubernetesHealth,
  fetchKubernetesInventory,
  resolveKubernetesDatasource,
} from './kubernetesData';

// `enabled` gates every fetch: with the k8s plugin absent or inaccessible no Prometheus query
// may fire, but hooks must still be called unconditionally by the consumer.
export function useKubernetesCardData(enabled: boolean) {
  const {
    value: datasource,
    loading: resolving,
    error: resolutionError,
  } = useAsync(() => (enabled ? resolveKubernetesDatasource() : Promise.resolve(null)), [enabled]);
  const { value: inventory, loading: inventoryLoading } = useAsync(
    () => (enabled ? fetchKubernetesInventory() : Promise.resolve(undefined)),
    [enabled]
  );
  const { value: health } = useAsync(() => (enabled ? fetchKubernetesHealth() : Promise.resolve(undefined)), [enabled]);
  const { value: cpuSeries, loading: cpuLoading } = useAsync(
    () => (enabled ? fetchClusterCpuSeries() : Promise.resolve(null)),
    [enabled]
  );
  return {
    datasource,
    resolving,
    resolutionError,
    inventory,
    inventoryLoading,
    health,
    cpuSeries,
    cpuLoading,
  };
}
