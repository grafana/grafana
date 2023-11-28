import { render, screen } from '@testing-library/react';
import React from 'react';
import { Databases } from 'app/percona/shared/core';
import { kubernetesStub } from '../../__mocks__/kubernetesStubs';
import { KubernetesOperatorStatus } from './KubernetesOperatorStatus';
import { KubernetesOperatorStatus as Status } from './KubernetesOperatorStatus.types';
describe('KubernetesOperatorStatus::', () => {
    it('renders installation link when unavailable', () => {
        render(React.createElement(KubernetesOperatorStatus, { operator: { status: Status.unavailable }, databaseType: Databases.mongodb, kubernetes: kubernetesStub[0], setSelectedCluster: jest.fn(), setOperatorToUpdate: jest.fn(), setUpdateOperatorModalVisible: jest.fn() }));
        expect(screen.getByTestId('cluster-link')).toBeInTheDocument();
    });
    it("doesn't render link when installed", () => {
        render(React.createElement(KubernetesOperatorStatus, { operator: { status: Status.ok }, databaseType: Databases.mongodb, kubernetes: kubernetesStub[0], setSelectedCluster: jest.fn(), setOperatorToUpdate: jest.fn(), setUpdateOperatorModalVisible: jest.fn() }));
        expect(screen.queryByTestId('cluster-link')).not.toBeInTheDocument();
    });
    it('renders link when available new version is available', () => {
        render(React.createElement(KubernetesOperatorStatus, { operator: { status: Status.ok, availableVersion: '1.4.3' }, databaseType: Databases.mongodb, kubernetes: kubernetesStub[0], setSelectedCluster: jest.fn(), setOperatorToUpdate: jest.fn(), setUpdateOperatorModalVisible: jest.fn() }));
        expect(screen.getByTestId('cluster-link')).toBeInTheDocument();
    });
});
//# sourceMappingURL=KubernetesOperatorStatus.test.js.map