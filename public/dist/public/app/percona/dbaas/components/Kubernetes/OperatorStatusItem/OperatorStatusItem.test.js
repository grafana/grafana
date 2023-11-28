import { render } from '@testing-library/react';
import React from 'react';
import { Databases } from 'app/percona/shared/core';
import { kubernetesStub } from '../__mocks__/kubernetesStubs';
import { KubernetesOperatorStatus } from './KubernetesOperatorStatus/KubernetesOperatorStatus.types';
import { OperatorStatusItem } from './OperatorStatusItem';
describe('OperatorStatusItem::', () => {
    it('renders', () => {
        const { container } = render(React.createElement(OperatorStatusItem, { databaseType: Databases.mysql, operator: { status: KubernetesOperatorStatus.ok }, kubernetes: kubernetesStub[0], setSelectedCluster: jest.fn(), setOperatorToUpdate: jest.fn(), setUpdateOperatorModalVisible: jest.fn() }));
        expect(container).toHaveTextContent('Percona Operator for MySQL');
        expect(container).toHaveTextContent('Installed');
        expect(container).not.toHaveTextContent('1.8.0');
    });
    it('renders with operator version', () => {
        const operator = { status: KubernetesOperatorStatus.ok, version: '1.8.0' };
        const { container } = render(React.createElement(OperatorStatusItem, { databaseType: Databases.mysql, operator: operator, kubernetes: kubernetesStub[0], setSelectedCluster: jest.fn(), setOperatorToUpdate: jest.fn(), setUpdateOperatorModalVisible: jest.fn() }));
        expect(container).toHaveTextContent('Percona Operator for MySQL');
        expect(container).toHaveTextContent('Installed');
        expect(container).toHaveTextContent('1.8.0');
    });
});
//# sourceMappingURL=OperatorStatusItem.test.js.map