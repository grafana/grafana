import { Databases } from 'app/percona/shared/core';
import { Operator } from '../Kubernetes.types';

export interface DBClusterConnectionItemProps {
  dataQa?: string;
  databaseType: Databases;
  operator: Operator;
}
