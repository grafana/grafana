import { Databases } from 'app/percona/shared/core';
import { Kubernetes } from '../../Kubernetes.types';
import { OPERATORS_DOCS_URL, OPERATORS_RN_URL, VERSION_PLACEHOLDER } from './OperatorStatus/OperatorStatus.constants';
import { KubernetesOperatorStatus } from './KubernetesOperatorStatus.types';

export const hasActiveOperator = (kubernetes: Kubernetes) =>
  Object.values(kubernetes.operators).filter(({ status }) => status === KubernetesOperatorStatus.ok).length > 0;

export const getStatusLink = (status: KubernetesOperatorStatus, databaseType: Databases, version?: string) =>
  status === KubernetesOperatorStatus.unavailable
    ? OPERATORS_DOCS_URL[databaseType]
    : OPERATORS_RN_URL[databaseType].replace(VERSION_PLACEHOLDER, version || '');
