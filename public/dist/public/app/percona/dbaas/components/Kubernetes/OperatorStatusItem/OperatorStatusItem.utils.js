import { OPERATOR_LABELS } from 'app/percona/shared/core';
export const buildOperatorLabel = ({ version }, databaseType) => version ? `${OPERATOR_LABELS[databaseType]} ${version}` : OPERATOR_LABELS[databaseType];
//# sourceMappingURL=OperatorStatusItem.utils.js.map