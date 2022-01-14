import { Databases } from 'app/percona/shared/core';

export enum KubernetesOperatorStatus {
  ok = 'OPERATORS_STATUS_OK',
  invalid = 'OPERATORS_STATUS_INVALID',
  unsupported = 'OPERATORS_STATUS_UNSUPPORTED',
  unavailable = 'OPERATORS_STATUS_NOT_INSTALLED',
}

export interface KubernetesOperatorStatusProps {
  status: KubernetesOperatorStatus;
  databaseType: Databases;
}
