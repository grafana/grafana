import { SelectableValue } from '@grafana/data';

import { KubernetesService } from '../../../../Kubernetes/Kubernetes.service';

export const ConfigurationService = {
  async loadStorageClassOptions(k8sClusterName: string): Promise<Array<SelectableValue<string>>> {
    const storageClassesResponse = await KubernetesService.getStorageClasses(k8sClusterName);
    const storageClasses = storageClassesResponse?.storage_classes || [];
    return storageClasses.map((storageClass) => ({
      label: storageClass,
      value: storageClass,
    }));
  },
};
