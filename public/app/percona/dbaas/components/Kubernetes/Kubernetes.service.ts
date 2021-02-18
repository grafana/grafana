import { apiManagement } from 'app/percona/shared/helpers/api';
import { Kubernetes, KubernetesListAPI, NewKubernetesCluster, NewKubernetesClusterAPI } from './Kubernetes.types';

export const KubernetesService = {
  getKubernetes() {
    return apiManagement.post<KubernetesListAPI, any>('/DBaaS/Kubernetes/List', {});
  },
  deleteKubernetes(kubernetes: Kubernetes, force?: boolean) {
    return apiManagement.post<any, any>('/DBaaS/Kubernetes/Unregister', toAPI(kubernetes, force));
  },
  getKubernetesConfig(kubernetes: Kubernetes) {
    return apiManagement.post<any, any>('/DBaaS/Kubernetes/Get', toAPI(kubernetes));
  },
  addKubernetes(kubernetes: NewKubernetesCluster) {
    return apiManagement.post<NewKubernetesClusterAPI, any>('/DBaaS/Kubernetes/Register', newClusterToApi(kubernetes));
  },
};

const toAPI = (kubernetes: Kubernetes, force?: boolean) => ({
  kubernetes_cluster_name: kubernetes.kubernetesClusterName,
  force,
});

const newClusterToApi = (newCluster: NewKubernetesCluster): NewKubernetesClusterAPI => ({
  kubernetes_cluster_name: newCluster.name,
  kube_auth: {
    kubeconfig: newCluster.kubeConfig,
  },
});
