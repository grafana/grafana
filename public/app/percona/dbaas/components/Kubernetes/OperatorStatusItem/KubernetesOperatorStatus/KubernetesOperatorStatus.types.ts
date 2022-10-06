import { BadgeColor } from '@grafana/ui/src';
import { Databases } from 'app/percona/shared/core';

import { Kubernetes, Operator, OperatorToUpdate } from '../../Kubernetes.types';

export enum KubernetesOperatorStatus {
  ok = 'OPERATORS_STATUS_OK',
  invalid = 'OPERATORS_STATUS_INVALID',
  unsupported = 'OPERATORS_STATUS_UNSUPPORTED',
  unavailable = 'OPERATORS_STATUS_NOT_INSTALLED',
}

export const KubernetesOperatorStatusColors: Record<KubernetesOperatorStatus, BadgeColor> = {
  [KubernetesOperatorStatus.ok]: 'green',
  [KubernetesOperatorStatus.unsupported]: 'purple',
  [KubernetesOperatorStatus.unavailable]: 'blue',
  [KubernetesOperatorStatus.invalid]: 'red',
};

export interface KubernetesOperatorStatusProps {
  operator: Operator;
  databaseType: Databases;
  kubernetes: Kubernetes;
  setSelectedCluster: (kubernetes: Kubernetes) => void;
  setOperatorToUpdate: (operator: OperatorToUpdate) => void;
  setUpdateOperatorModalVisible: (isVisible: boolean) => void;
}
