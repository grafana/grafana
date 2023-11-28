import { render, screen } from '@testing-library/react';
import React from 'react';
import { KubernetesClusterStatus } from './KubernetesClusterStatus';
import { KubernetesClusterStatus as Status } from './KubernetesClusterStatus.types';
describe('DBClusterStatus::', () => {
    it('renders correctly when ok', () => {
        render(React.createElement(KubernetesClusterStatus, { status: Status.ok }));
        expect(screen.getByTestId('cluster-status-ok')).toBeInTheDocument();
    });
    it('renders correctly when invalid', () => {
        render(React.createElement(KubernetesClusterStatus, { status: Status.invalid }));
        expect(screen.getByTestId('cluster-status-invalid')).toBeInTheDocument();
    });
    it('renders correctly when unavailable', () => {
        render(React.createElement(KubernetesClusterStatus, { status: Status.unavailable }));
        expect(screen.getByTestId('cluster-status-unavailable')).toBeInTheDocument();
    });
});
//# sourceMappingURL=KubernetesClusterStatus.test.js.map