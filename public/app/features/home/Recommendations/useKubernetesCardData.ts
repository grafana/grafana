import { useAsync } from 'react-use';

import {
  fetchClusterCpuSeries,
  fetchKubernetesHealth,
  fetchKubernetesInventory,
  resolveKubernetesDatasource,
} from './kubernetesData';

export function useKubernetesCardData(enabled: boolean) {
  const { value: datasource, loading: resolving, error: resolutionError } = useAsync(
    async () => (enabled ? resolveKubernetesDatasource() : undefined),
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
