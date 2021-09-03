import { Databases, OPERATOR_LABELS } from 'app/percona/shared/core';
import { Operator } from '../Kubernetes.types';

export const buildOperatorLabel = ({ version }: Operator, databaseType: Databases) =>
  version ? `${OPERATOR_LABELS[databaseType]} ${version}` : OPERATOR_LABELS[databaseType];
