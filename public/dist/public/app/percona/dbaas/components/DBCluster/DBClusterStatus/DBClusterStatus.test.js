import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '../../../../../store/configureStore';
import { DBClusterStatus as Status } from '../DBCluster.types';
import { dbClustersStub } from '../__mocks__/dbClustersStubs';
import { DBClusterStatus } from './DBClusterStatus';
describe('DBClusterStatus::', () => {
    it('renders correctly when active', () => {
        const dbCluster = Object.assign(Object.assign({}, dbClustersStub[0]), { status: Status.ready, message: 'Should not render error', finishedSteps: 10, totalSteps: 10 });
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { result: { dbaasEnabled: true } },
                },
            }) },
            React.createElement(DBClusterStatus, { dbCluster: dbCluster, setLogsModalVisible: jest.fn() })));
        expect(screen.getByTestId('cluster-status-active')).toBeInTheDocument();
        expect(screen.queryByTestId('cluster-status-error-message')).not.toBeInTheDocument();
    });
    it('renders progress bar and error when changing', () => {
        const dbCluster = Object.assign(Object.assign({}, dbClustersStub[0]), { status: Status.changing, message: 'Should render error', finishedSteps: 5, totalSteps: 10 });
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { result: { dbaasEnabled: true } },
                },
            }) },
            React.createElement(DBClusterStatus, { dbCluster: dbCluster, setLogsModalVisible: jest.fn() })));
        expect(screen.queryByTestId('cluster-status-active')).not.toBeInTheDocument();
        expect(screen.getByTestId('cluster-progress-bar')).toBeInTheDocument();
        expect(screen.getByTestId('cluster-status-error-message')).toBeInTheDocument();
    });
    it('renders error and progress bar when failed', () => {
        const dbCluster = Object.assign(Object.assign({}, dbClustersStub[0]), { status: Status.failed, message: 'Should render error', finishedSteps: 10, totalSteps: 10 });
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { result: { dbaasEnabled: true } },
                },
            }) },
            React.createElement(DBClusterStatus, { dbCluster: dbCluster, setLogsModalVisible: jest.fn() })));
        expect(screen.queryByTestId('cluster-status-active')).not.toBeInTheDocument();
        expect(screen.getByTestId('cluster-progress-bar')).toBeInTheDocument();
        expect(screen.getByTestId('cluster-status-error-message')).toBeInTheDocument();
    });
});
//# sourceMappingURL=DBClusterStatus.test.js.map