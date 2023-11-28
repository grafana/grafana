import { Databases, OPERATOR_LABELS } from 'app/percona/shared/core';
import { KubernetesOperatorStatus } from './KubernetesOperatorStatus/KubernetesOperatorStatus.types';
import { buildOperatorLabel } from './OperatorStatusItem.utils';
describe('OperatorStatusItems.utils:: ', () => {
    it('should return operator label with version', () => {
        const operator = {
            status: KubernetesOperatorStatus.ok,
            version: '1.8.0',
        };
        const expected = `${OPERATOR_LABELS[Databases.mysql]} 1.8.0`;
        expect(buildOperatorLabel(operator, Databases.mysql)).toEqual(expected);
    });
    it('should return operator label without version', () => {
        const operator = { status: KubernetesOperatorStatus.ok };
        const expected = OPERATOR_LABELS[Databases.mysql];
        expect(buildOperatorLabel(operator, Databases.mysql)).toEqual(expected);
    });
});
//# sourceMappingURL=OperatorStatusItem.utils.test.js.map