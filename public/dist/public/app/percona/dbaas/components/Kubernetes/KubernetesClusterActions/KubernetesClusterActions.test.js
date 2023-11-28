import { __awaiter } from "tslib";
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { kubernetesStub } from '../__mocks__/kubernetesStubs';
import { KubernetesClusterActions } from './KubernetesClusterActions';
describe('KubernetesClusterActions::', () => {
    it('renders correctly', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(KubernetesClusterActions, { kubernetesCluster: kubernetesStub[0], setSelectedCluster: jest.fn(), setDeleteModalVisible: jest.fn(), setViewConfigModalVisible: jest.fn(), setManageComponentsModalVisible: jest.fn(), getDBClusters: jest.fn() }));
        expect(screen.getByTestId('dropdown-menu-toggle')).toBeInTheDocument();
        expect(screen.getByTestId('dropdown-menu-container')).toBeInTheDocument();
    }));
    it('Select delete actions', () => __awaiter(void 0, void 0, void 0, function* () {
        const setSelectedCluster = jest.fn();
        const setDeleteModalVisible = jest.fn();
        render(React.createElement(KubernetesClusterActions, { kubernetesCluster: kubernetesStub[1], setSelectedCluster: setSelectedCluster, setDeleteModalVisible: setDeleteModalVisible, setViewConfigModalVisible: jest.fn(), setManageComponentsModalVisible: jest.fn(), getDBClusters: jest.fn() }));
        fireEvent.click(screen.getByRole('button'));
        fireEvent.click(screen.getByText('Unregister'));
        yield waitFor(() => expect(setSelectedCluster).toHaveBeenCalled());
        yield waitFor(() => expect(setDeleteModalVisible).toHaveBeenCalled());
    }));
    it('Select view cluster config action', () => __awaiter(void 0, void 0, void 0, function* () {
        const setSelectedCluster = jest.fn();
        const setDeleteModalVisible = jest.fn();
        const setViewConfigModalVisible = jest.fn();
        render(React.createElement(KubernetesClusterActions, { kubernetesCluster: kubernetesStub[1], setSelectedCluster: setSelectedCluster, setDeleteModalVisible: setDeleteModalVisible, setViewConfigModalVisible: setViewConfigModalVisible, setManageComponentsModalVisible: jest.fn(), getDBClusters: jest.fn() }));
        fireEvent.click(screen.getByRole('button'));
        fireEvent.click(screen.getByText('Show configuration'));
        yield waitFor(() => expect(setSelectedCluster).toHaveBeenCalled());
        yield waitFor(() => expect(setViewConfigModalVisible).toHaveBeenCalled());
    }));
});
//# sourceMappingURL=KubernetesClusterActions.test.js.map