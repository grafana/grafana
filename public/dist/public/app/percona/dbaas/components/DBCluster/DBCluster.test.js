import { __awaiter } from "tslib";
import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { DATABASE_LABELS } from 'app/percona/shared/core';
import { configureStore } from 'app/store/configureStore';
import { KubernetesClusterStatus } from '../Kubernetes/KubernetesClusterStatus/KubernetesClusterStatus.types';
import { KubernetesOperatorStatus } from '../Kubernetes/OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';
import { DBCluster } from './DBCluster';
import { DBClusterService } from './DBCluster.service';
import { DBClusterStatus } from './DBCluster.types';
import { formatDBClusterVersion } from './DBCluster.utils';
jest.mock('app/core/app_events');
jest.mock('app/percona/dbaas/components/Kubernetes/Kubernetes.service');
jest.mock('app/percona/dbaas/components/DBCluster/DBCluster.service');
jest.mock('app/percona/shared/helpers/logger', () => {
    const originalModule = jest.requireActual('app/percona/shared/helpers/logger');
    return Object.assign(Object.assign({}, originalModule), { logger: {
            error: jest.fn(),
        } });
});
describe('DBCluster::', () => {
    it('renders correctly without clusters', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: true, dbaasEnabled: true } },
                    kubernetes: {
                        loading: false,
                    },
                    addKubernetes: { loading: false },
                    deleteKubernetes: { loading: false },
                    dbClusters: { loading: false },
                },
            }) },
            React.createElement(DBCluster, null)));
        yield waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
        expect(yield screen.getAllByTestId('dbcluster-add-cluster-button')).toHaveLength(2);
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    }));
    it('renders correctly with clusters', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: true, dbaasEnabled: true } },
                    kubernetes: {
                        loading: false,
                    },
                    addKubernetes: { loading: false },
                    deleteKubernetes: { loading: false },
                    dbClusters: {
                        loading: false,
                        result: [
                            {
                                clusterName: 'cluster_1',
                                kubernetesClusterName: 'cluster_1',
                                databaseType: 'mongodb',
                                clusterSize: 1,
                                memory: 1000,
                                cpu: 1000,
                                disk: 1000,
                                status: DBClusterStatus.unknown,
                                message: 'Error',
                            },
                        ],
                    },
                },
            }) },
            React.createElement(DBCluster, null)));
        yield waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
        expect(yield screen.getAllByTestId('dbcluster-add-cluster-button')).toHaveLength(1);
        expect(screen.getAllByTestId('table-row')).toHaveLength(1);
    }));
    it('renders correctly with failed status', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: true, dbaasEnabled: true } },
                    kubernetes: {
                        loading: false,
                    },
                    addKubernetes: { loading: false },
                    deleteKubernetes: { loading: false },
                    dbClusters: {
                        loading: false,
                        result: [
                            {
                                clusterName: 'cluster_1',
                                kubernetesClusterName: 'cluster_1',
                                databaseType: 'mongodb',
                                clusterSize: 1,
                                memory: 1000,
                                cpu: 1000,
                                disk: 1000,
                                status: DBClusterStatus.failed,
                                message: 'Error',
                            },
                        ],
                    },
                },
            }) },
            React.createElement(DBCluster, null)));
        yield waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
        expect(yield screen.getAllByTestId('cluster-progress-bar').length).toBeGreaterThan(0);
        expect(yield screen.getAllByTestId('cluster-status-error-message').length).toBeGreaterThan(0);
    }));
    it('renders database types correctly', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: true, dbaasEnabled: true } },
                    kubernetes: {
                        loading: false,
                    },
                    addKubernetes: { loading: false },
                    deleteKubernetes: { loading: false },
                    dbClusters: {
                        loading: false,
                        result: [
                            {
                                clusterName: 'cluster_1',
                                kubernetesClusterName: 'cluster_1',
                                databaseType: 'mongodb',
                                clusterSize: 1,
                                memory: 1000,
                                cpu: 1000,
                                disk: 1000,
                                status: DBClusterStatus.failed,
                                message: 'Error',
                                installedImage: 'percona/percona-xtra-dbcluster:8.0',
                            },
                        ],
                    },
                },
            }) },
            React.createElement(DBCluster, null)));
        yield waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
        expect(screen.getAllByRole('cell')[1].textContent).toEqual(`${DATABASE_LABELS.mongodb} ${formatDBClusterVersion('percona/percona-xtra-dbcluster:8.0')}`);
    }));
    it('should renders DBClustersList when one of k8s clusters unavailable', () => __awaiter(void 0, void 0, void 0, function* () {
        const spy = jest.spyOn(DBClusterService, 'getDBClusters');
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: true, dbaasEnabled: true } },
                    kubernetes: {
                        loading: false,
                        result: [
                            {
                                kubernetesClusterName: 'cluster1',
                                status: KubernetesClusterStatus.ok,
                                operators: {
                                    psmdb: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
                                    pxc: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
                                },
                            },
                            {
                                kubernetesClusterName: 'cluster2',
                                status: KubernetesClusterStatus.unavailable,
                                operators: {
                                    psmdb: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
                                    pxc: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
                                },
                            },
                            {
                                kubernetesClusterName: 'cluster3',
                                status: KubernetesClusterStatus.invalid,
                                operators: {
                                    psmdb: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
                                    pxc: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
                                },
                            },
                        ],
                    },
                    addKubernetes: { loading: false },
                    deleteKubernetes: { loading: false },
                },
            }) },
            React.createElement(DBCluster, null)));
        yield waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
        expect(spy).toBeCalledTimes(1);
        expect(spy).toBeCalledWith(expect.objectContaining({ kubernetesClusterName: 'cluster1' }), expect.anything());
        spy.mockClear();
    }));
});
//# sourceMappingURL=DBCluster.test.js.map