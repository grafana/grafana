import { Databases } from 'app/percona/shared/core';
import { Operator } from '../../Kubernetes.types';

export enum KubernetesOperatorStatus {
  ok = 'OPERATORS_STATUS_OK',
  invalid = 'OPERATORS_STATUS_INVALID',
  unsupported = 'OPERATORS_STATUS_UNSUPPORTED',
  unavailable = 'OPERATORS_STATUS_NOT_INSTALLED',
}

export interface KubernetesOperatorStatusProps {
  operator: Operator;
  databaseType: Databases;
}
