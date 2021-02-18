export enum KubernetesClusterStatus {
  invalid = 'KUBERNETES_CLUSTER_STATUS_INVALID',
  ok = 'KUBERNETES_CLUSTER_STATUS_OK',
  unavailable = 'KUBERNETES_CLUSTER_STATUS_UNAVAILABLE',
}

export interface KubernetesClusterStatusProps {
  status: KubernetesClusterStatus;
}
