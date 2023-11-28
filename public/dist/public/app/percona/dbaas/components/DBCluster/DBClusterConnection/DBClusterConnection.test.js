import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { dbClustersStub, mongoDBClusterConnectionStub } from '../__mocks__/dbClustersStubs';
import { DBClusterConnection } from './DBClusterConnection';
jest.mock('app/core/app_events');
jest.mock('../XtraDB.service');
jest.mock('../PSMDB.service');
jest.mock('app/percona/shared/helpers/logger', () => {
    const originalModule = jest.requireActual('app/percona/shared/helpers/logger');
    return Object.assign(Object.assign({}, originalModule), { logger: {
            error: jest.fn(),
        } });
});
describe('DBClusterConnection::', () => {
    it('renders correctly connection items', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => render(React.createElement(DBClusterConnection, { dbCluster: dbClustersStub[0] })));
        expect(screen.getByTestId('cluster-connection-host')).toBeInTheDocument();
        expect(screen.getByTestId('cluster-connection-port')).toBeInTheDocument();
        expect(screen.getByTestId('cluster-connection-username')).toBeInTheDocument();
        expect(screen.getByTestId('cluster-connection-password')).toBeInTheDocument();
    }));
    it('renders correctly connection items with MongoDB cluster', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => render(React.createElement(DBClusterConnection, { dbCluster: dbClustersStub[2] })));
        expect(screen.getByTestId('cluster-connection-host')).toBeInTheDocument();
        expect(screen.getByTestId('cluster-connection-host')).toHaveTextContent(mongoDBClusterConnectionStub.host);
        expect(screen.getByTestId('cluster-connection-port')).toBeInTheDocument();
        expect(screen.getByTestId('cluster-connection-username')).toBeInTheDocument();
        expect(screen.getByTestId('cluster-connection-password')).toBeInTheDocument();
    }));
    it('does not show loading when the DBcluster paused', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => render(React.createElement(DBClusterConnection, { dbCluster: dbClustersStub[5] })));
        expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
    }));
    it('show loading when the DBcluster status = upgrading', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => render(React.createElement(DBClusterConnection, { dbCluster: dbClustersStub[6] })));
        expect(screen.getByTestId('Spinner')).toBeInTheDocument();
    }));
    it('show loading when the DBcluster status = changing', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => render(React.createElement(DBClusterConnection, { dbCluster: dbClustersStub[7] })));
        expect(screen.getByTestId('Spinner')).toBeInTheDocument();
    }));
    it('show loading when the DBcluster status = deleting', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => render(React.createElement(DBClusterConnection, { dbCluster: dbClustersStub[8] })));
        expect(screen.getByTestId('Spinner')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=DBClusterConnection.test.js.map