import { Databases } from 'app/percona/shared/core';
import { Kubernetes, Operator, OperatorToUpdate } from '../Kubernetes.types';

export interface OperatorStatusItemProps {
  dataQa?: string;
  databaseType: Databases;
  operator: Operator;
  kubernetes: Kubernetes;
  setSelectedCluster: (kubernetes: Kubernetes) => void;
  setOperatorToUpdate: (operator: OperatorToUpdate) => void;
  setUpdateOperatorModalVisible: (isVisible: boolean) => void;
}
