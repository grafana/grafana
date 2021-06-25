import { Operators } from '../DBCluster/AddDBClusterModal/DBClusterBasicOptions/DBClusterBasicOptions.types';
import { Kubernetes, Operator } from './Kubernetes.types';
import { KubernetesClusterStatus } from './KubernetesClusterStatus/KubernetesClusterStatus.types';
import { KubernetesOperatorStatus } from './OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';
import { ActiveOperatorsMap } from '../DBCluster/DBCluster.types';
import { DATABASE_OPERATORS, DATABASE_OPTIONS } from '../DBCluster/DBCluster.constants';

export const isKubernetesListUnavailable = (kubernetes: Kubernetes[]) =>
  !!!kubernetes.find((k) => k.status === KubernetesClusterStatus.ok);

export const getActiveOperators = (kubernetes: Kubernetes[]): Operators[] => {
  const activeOperatorsMap: ActiveOperatorsMap = {};

  const activeOperators = kubernetes.reduce((acc, k) => {
    const activeOperators: Operators[] = [];

    Object.entries(k.operators).forEach(([operator, { status }]: [Operators, Operator]) => {
      if (!activeOperatorsMap[operator] && status === KubernetesOperatorStatus.ok) {
        activeOperators.push(operator);
        activeOperatorsMap[operator] = true;
      }
    });

    return [...acc, ...activeOperators];
  }, []);

  return activeOperators;
};

export const getDatabaseOptionFromOperator = (operator: Operators) =>
  DATABASE_OPTIONS.find(({ value }) => value === DATABASE_OPERATORS[operator]);
