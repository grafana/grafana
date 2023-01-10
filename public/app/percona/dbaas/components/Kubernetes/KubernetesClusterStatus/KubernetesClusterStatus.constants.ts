import { KubernetesClusterStatus } from './KubernetesClusterStatus.types';

export const STATUS_DATA_QA = {
  [KubernetesClusterStatus.invalid]: 'invalid',
  [KubernetesClusterStatus.ok]: 'ok',
  [KubernetesClusterStatus.unavailable]: 'unavailable',
  [KubernetesClusterStatus.provisioning]: 'provisioning',
};
