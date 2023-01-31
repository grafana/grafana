import { CancelToken } from 'axios';

import { apiManagement } from 'app/percona/shared/helpers/api';

import {
  CheckOperatorUpdateAPI,
  ComponentToUpdate,
  InstallOperatorRequest,
  InstallOperatorResponse,
  KubeConfigResponse,
  Kubernetes,
  KubernetesListAPI,
  NewKubernetesCluster,
  NewKubernetesClusterAPI,
  StorageClassesRequest,
  StorageClassesResponse,
} from './Kubernetes.types';

export const KubernetesService = {
  getKubernetes(token?: CancelToken) {
    return apiManagement.post<KubernetesListAPI, object>('/DBaaS/Kubernetes/List', {}, true, token);
  },
  deleteKubernetes(kubernetes: Kubernetes, force?: boolean, token?: CancelToken) {
    return apiManagement.post<void, object>('/DBaaS/Kubernetes/Unregister', toAPI(kubernetes, force), false, token);
  },
  getKubernetesConfig(kubernetes: Kubernetes, token?: CancelToken) {
    return apiManagement.post<KubeConfigResponse, object>('/DBaaS/Kubernetes/Get', toAPI(kubernetes), false, token);
  },
  getStorageClasses(kubernetesClasterName: string): Promise<StorageClassesResponse> {
    return apiManagement.post<object, StorageClassesRequest>(
      '/DBaaS/Kubernetes/StorageClasses/List',
      { kubernetes_cluster_name: kubernetesClasterName },
      false
    );
  },
  addKubernetes(kubernetes: NewKubernetesCluster, token?: CancelToken) {
    return apiManagement.post<NewKubernetesClusterAPI, NewKubernetesClusterAPI>(
      '/DBaaS/Kubernetes/Register',
      newClusterToApi(kubernetes),
      false,
      token
    );
  },
  checkForOperatorUpdate(token?: CancelToken) {
    return apiManagement.post<CheckOperatorUpdateAPI, object>(
      '/DBaaS/Components/CheckForOperatorUpdate',
      {},
      false,
      token
    );
  },
  installOperator(
    kubernetesClusterName: string,
    operatorType: ComponentToUpdate,
    version: string,
    token?: CancelToken
  ) {
    return apiManagement.post<InstallOperatorResponse, InstallOperatorRequest>(
      '/DBaaS/Components/InstallOperator',
      {
        kubernetes_cluster_name: kubernetesClusterName,
        operator_type: operatorType,
        version,
      },
      false,
      token
    );
  },
  getDBClusters(kubernetes: Kubernetes, token?: CancelToken) {
    return apiManagement.post<void, Kubernetes>('/DBaaS/DBClusters/List', kubernetes, true, token);
  },
};

const toAPI = (kubernetes: Kubernetes, force?: boolean) => ({
  kubernetes_cluster_name: kubernetes.kubernetesClusterName,
  force,
});

const newClusterToApi = ({
  name,
  kubeConfig,
  isEKS,
  awsAccessKeyID,
  awsSecretAccessKey,
}: NewKubernetesCluster): NewKubernetesClusterAPI => {
  const cluster: NewKubernetesClusterAPI = {
    kubernetes_cluster_name: name,
    kube_auth: {
      kubeconfig: kubeConfig,
    },
  };

  if (isEKS) {
    cluster.aws_access_key_id = awsAccessKeyID;
    cluster.aws_secret_access_key = awsSecretAccessKey;
  }

  return cluster;
};
