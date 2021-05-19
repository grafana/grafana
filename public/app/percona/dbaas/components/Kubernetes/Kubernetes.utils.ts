import { Kubernetes } from './Kubernetes.types';
import { KubernetesClusterStatus } from './KubernetesClusterStatus/KubernetesClusterStatus.types';

export const isKubernetesListUnavailable = (kubernetes: Kubernetes[]) =>
  !!!kubernetes.find((k) => k.status === KubernetesClusterStatus.ok);
