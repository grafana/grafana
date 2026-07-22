import { useAsync } from 'react-use';

import {
  fetchClusterCpuSeries,
  fetchKubernetesHealth,
  fetchKubernetesInventory,
  resolveKubernetesDatasource,
} from './kubernetesData';

export function useKubernetesCardData() {
  const { value: datasource, loading: resolving, error: resolutionError } = useAsync(resolveKubernetesDatasource, []);
  const { value: inventory, loading: inventoryLoading } = useAsync(fetchKubernetesInventory, []);
  const { value: health } = useAsync(fetchKubernetesHealth, []);
  const { value: cpuSeries, loading: cpuLoading } = useAsync(fetchClusterCpuSeries, []);
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
