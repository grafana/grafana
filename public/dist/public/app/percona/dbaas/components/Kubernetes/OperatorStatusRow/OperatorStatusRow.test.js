import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '../../../../../store/configureStore';
import { KubernetesClusterStatus } from '../KubernetesClusterStatus/KubernetesClusterStatus.types';
import { KubernetesOperatorStatus } from '../OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';
import { OperatorStatusRow } from './OperatorStatusRow';
describe('OperatorStatusRow::', () => {
    it('createDBCluster button should be disabled when kubernetesClusterStatus is invalid', () => __awaiter(void 0, void 0, void 0, function* () {
        const element = {
            kubernetesClusterName: 'cluster1',
            status: KubernetesClusterStatus.invalid,
            operators: {
                psmdb: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
                pxc: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
            },
        };
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: true, dbaasEnabled: true } },
                },
            }) },
            React.createElement(OperatorStatusRow, { element: element, setSelectedCluster: jest.fn, setOperatorToUpdate: jest.fn, setUpdateOperatorModalVisible: jest.fn })));
        expect(screen.getByTestId('cluster1-add-cluster-button')).toBeDisabled();
    }));
    it('createDBCluster button should be disabled when kubernetesClusterStatus is unavailable', () => __awaiter(void 0, void 0, void 0, function* () {
        const element = {
            kubernetesClusterName: 'cluster1',
            status: KubernetesClusterStatus.unavailable,
            operators: {
                psmdb: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
                pxc: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
            },
        };
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: true, dbaasEnabled: true } },
                },
            }) },
            React.createElement(OperatorStatusRow, { element: element, setSelectedCluster: jest.fn, setOperatorToUpdate: jest.fn, setUpdateOperatorModalVisible: jest.fn })));
        expect(screen.getByTestId('cluster1-add-cluster-button')).toBeDisabled();
    }));
    it('createDBCluster button should be disabled when both operators are not ok', () => __awaiter(void 0, void 0, void 0, function* () {
        const element = {
            kubernetesClusterName: 'cluster1',
            status: KubernetesClusterStatus.ok,
            operators: {
                psmdb: { status: KubernetesOperatorStatus.invalid, version: '1', availableVersion: '1' },
                pxc: { status: KubernetesOperatorStatus.unsupported, version: '1', availableVersion: '1' },
            },
        };
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: true, dbaasEnabled: true } },
                },
            }) },
            React.createElement(OperatorStatusRow, { element: element, setSelectedCluster: jest.fn, setOperatorToUpdate: jest.fn, setUpdateOperatorModalVisible: jest.fn })));
        expect(screen.getByTestId('cluster1-add-cluster-button')).toBeDisabled();
    }));
    it('createDBCluster button should be disabled when both operators are not ok', () => __awaiter(void 0, void 0, void 0, function* () {
        const element = {
            kubernetesClusterName: 'cluster1',
            status: KubernetesClusterStatus.ok,
            operators: {
                psmdb: { status: KubernetesOperatorStatus.unavailable, version: '1', availableVersion: '1' },
                pxc: { status: KubernetesOperatorStatus.invalid, version: '1', availableVersion: '1' },
            },
        };
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: true, dbaasEnabled: true } },
                },
            }) },
            React.createElement(OperatorStatusRow, { element: element, setSelectedCluster: jest.fn, setOperatorToUpdate: jest.fn, setUpdateOperatorModalVisible: jest.fn })));
        expect(screen.getByTestId('cluster1-add-cluster-button')).toBeDisabled();
    }));
    it('createDBCluster button should be enabled when clusterStatus and operatorStatus have ok status', () => __awaiter(void 0, void 0, void 0, function* () {
        const element = {
            kubernetesClusterName: 'cluster1',
            status: KubernetesClusterStatus.ok,
            operators: {
                psmdb: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
                pxc: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
            },
        };
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: true, dbaasEnabled: true } },
                },
            }) },
            React.createElement(OperatorStatusRow, { element: element, setSelectedCluster: jest.fn, setOperatorToUpdate: jest.fn, setUpdateOperatorModalVisible: jest.fn })));
        expect(screen.getByTestId('cluster1-add-cluster-button')).not.toBeDisabled();
    }));
});
//# sourceMappingURL=OperatorStatusRow.test.js.map