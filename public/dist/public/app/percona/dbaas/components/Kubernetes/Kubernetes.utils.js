/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { DATABASE_OPERATORS, DATABASE_OPTIONS } from '../DBCluster/DBCluster.constants';
import { KubernetesClusterStatus } from './KubernetesClusterStatus/KubernetesClusterStatus.types';
import { KubernetesOperatorStatus } from './OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';
export const isKubernetesListUnavailable = (kubernetes) => !!!kubernetes.find((k) => k.status === KubernetesClusterStatus.ok);
export const getActiveOperators = (kubernetes) => {
    const activeOperatorsMap = {};
    const activeOperators = kubernetes.reduce((acc, k) => {
        const activeOperators = [];
        Object.entries(k.operators).forEach(([operator, { status }]) => {
            if (!activeOperatorsMap[operator] && status === KubernetesOperatorStatus.ok) {
                activeOperators.push(operator);
                activeOperatorsMap[operator] = true;
            }
        });
        return [...acc, ...activeOperators];
    }, []);
    return activeOperators;
};
export const getDatabaseOptionFromOperator = (operator) => DATABASE_OPTIONS.find(({ value }) => value === DATABASE_OPERATORS[operator]);
//# sourceMappingURL=Kubernetes.utils.js.map