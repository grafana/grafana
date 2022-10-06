import { BadgeColor } from '@grafana/ui/src';

export enum KubernetesClusterStatus {
  invalid = 'KUBERNETES_CLUSTER_STATUS_INVALID',
  ok = 'KUBERNETES_CLUSTER_STATUS_OK',
  unavailable = 'KUBERNETES_CLUSTER_STATUS_UNAVAILABLE',
}

export const KubernetesClusterStatusColors: Record<KubernetesClusterStatus, BadgeColor> = {
  [KubernetesClusterStatus.ok]: 'green',
  [KubernetesClusterStatus.invalid]: 'red',
  [KubernetesClusterStatus.unavailable]: 'blue',
};

export interface KubernetesClusterStatusProps {
  status: KubernetesClusterStatus;
}
