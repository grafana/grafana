import { KubernetesOperatorStatus } from './KubernetesOperatorStatus.types';
import { OPERATORS_DOCS_URL, OPERATORS_RN_URL, VERSION_PLACEHOLDER } from './OperatorStatus/OperatorStatus.constants';
export const hasActiveOperator = (kubernetes) => Object.values(kubernetes.operators).filter(({ status }) => status === KubernetesOperatorStatus.ok).length > 0;
export const getStatusLink = (status, databaseType, version) => status === KubernetesOperatorStatus.unavailable
    ? OPERATORS_DOCS_URL[databaseType]
    : OPERATORS_RN_URL[databaseType].replace(VERSION_PLACEHOLDER, version || '');
//# sourceMappingURL=KubernetesOperatorStatus.utils.js.map