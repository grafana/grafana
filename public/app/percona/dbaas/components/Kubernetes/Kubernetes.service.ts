import { apiManagement } from 'app/percona/shared/helpers/api';
import { CancelToken } from 'axios';
import {
  CheckOperatorUpdateAPI,
  Kubernetes,
  KubernetesListAPI,
  NewKubernetesCluster,
  NewKubernetesClusterAPI,
} from './Kubernetes.types';

export const KubernetesService = {
  getKubernetes(token?: CancelToken) {
    return apiManagement.post<KubernetesListAPI, any>('/DBaaS/Kubernetes/List', {}, true, token);
  },
  deleteKubernetes(kubernetes: Kubernetes, force?: boolean, token?: CancelToken) {
    return apiManagement.post<any, any>('/DBaaS/Kubernetes/Unregister', toAPI(kubernetes, force), false, token);
  },
  getKubernetesConfig(kubernetes: Kubernetes, token?: CancelToken) {
    return apiManagement.post<any, any>('/DBaaS/Kubernetes/Get', toAPI(kubernetes), false, token);
  },
  addKubernetes(kubernetes: NewKubernetesCluster, token?: CancelToken) {
    return apiManagement.post<NewKubernetesClusterAPI, any>(
      '/DBaaS/Kubernetes/Register',
      newClusterToApi(kubernetes),
      false,
      token
    );
  },
  checkForOperatorUpdate(token?: CancelToken) {
    return apiManagement.post<CheckOperatorUpdateAPI, any>(
      '/DBaaS/Components/CheckForOperatorUpdate',
      {},
      false,
      token
    );
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
