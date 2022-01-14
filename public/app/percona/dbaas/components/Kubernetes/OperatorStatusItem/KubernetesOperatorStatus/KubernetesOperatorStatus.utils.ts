import { Kubernetes } from '../../Kubernetes.types';
import { KubernetesOperatorStatus } from './KubernetesOperatorStatus.types';

export const hasActiveOperator = (kubernetes: Kubernetes) =>
  Object.values(kubernetes.operators).filter(({ status }) => status === KubernetesOperatorStatus.ok).length > 0;
