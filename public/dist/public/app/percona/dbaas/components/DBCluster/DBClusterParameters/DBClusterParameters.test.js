import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { dbClustersStub } from '../__mocks__/dbClustersStubs';
import { DBClusterParameters } from './DBClusterParameters';
jest.mock('app/core/app_events');
jest.mock('../XtraDB.service');
jest.mock('../PSMDB.service');
describe('DBClusterParameters::', () => {
    it('renders parameters items correctly', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(DBClusterParameters, { dbCluster: dbClustersStub[0] }));
        expect(screen.getByTestId('cluster-parameters-cluster-name')).toBeInTheDocument();
        const memory = screen.getByTestId('cluster-parameters-memory');
        const cpu = screen.getByTestId('cluster-parameters-cpu');
        const disk = screen.getByTestId('cluster-parameters-disk');
        const expose = screen.getByTestId('cluster-parameters-expose');
        expect(memory).toBeInTheDocument();
        expect(memory).toHaveTextContent('Memory:1024 GB');
        expect(cpu).toBeInTheDocument();
        expect(cpu).toHaveTextContent('CPU:1');
        expect(disk).toBeInTheDocument();
        expect(disk).toHaveTextContent('Disk:25 GB');
        expect(expose).toBeInTheDocument();
        expect(expose).toHaveTextContent('External Access:Enabled');
    }));
    it('renders parameters items correctly with MongoDB cluster', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(DBClusterParameters, { dbCluster: dbClustersStub[2] }));
        expect(screen.getByTestId('cluster-parameters-cluster-name')).toBeInTheDocument();
        const memory = screen.getByTestId('cluster-parameters-memory');
        const cpu = screen.getByTestId('cluster-parameters-cpu');
        const disk = screen.getByTestId('cluster-parameters-disk');
        const expose = screen.getByTestId('cluster-parameters-expose');
        expect(memory).toBeInTheDocument();
        expect(memory).toHaveTextContent('Memory:0 GB');
        expect(cpu).toBeInTheDocument();
        expect(cpu).toHaveTextContent('CPU:0');
        expect(disk).toBeInTheDocument();
        expect(disk).toHaveTextContent('Disk:25 GB');
        expect(expose).toBeInTheDocument();
        expect(expose).toHaveTextContent('External Access:Disabled');
    }));
});
//# sourceMappingURL=DBClusterParameters.test.js.map