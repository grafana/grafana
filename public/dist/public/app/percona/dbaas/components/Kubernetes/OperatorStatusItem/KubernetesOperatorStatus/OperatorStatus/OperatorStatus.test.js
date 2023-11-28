import { render, screen } from '@testing-library/react';
import React from 'react';
import { KubernetesOperatorStatus as Status } from '../KubernetesOperatorStatus.types';
import { OperatorStatus } from './OperatorStatus';
describe('OperatorStatus::', () => {
    it('renders correctly when active', () => {
        render(React.createElement(OperatorStatus, { operator: { status: Status.ok } }));
        expect(screen.getByTestId('cluster-status-ok')).toBeInTheDocument();
        expect(screen.queryByTestId('operator-version-available')).not.toBeInTheDocument();
    });
    it('renders available version when new version available and operator is installed', () => {
        const operator = { status: Status.ok, availableVersion: '1.8.0' };
        render(React.createElement(OperatorStatus, { operator: operator }));
        expect(screen.getByTestId('operator-version-available')).toBeInTheDocument();
    });
    it("doesn't render available version when operator is unavailable", () => {
        const operator = { status: Status.unavailable, availableVersion: '1.8.0' };
        render(React.createElement(OperatorStatus, { operator: operator }));
        expect(screen.queryByTestId('operator-version-available')).not.toBeInTheDocument();
    });
});
//# sourceMappingURL=OperatorStatus.test.js.map