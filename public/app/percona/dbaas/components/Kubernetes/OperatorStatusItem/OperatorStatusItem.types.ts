import { Databases } from 'app/percona/shared/core';
import { KubernetesOperatorStatus } from './KubernetesOperatorStatus/KubernetesOperatorStatus.types';

export interface DBClusterConnectionItemProps {
  dataQa?: string;
  databaseType: Databases;
  status: KubernetesOperatorStatus;
}
