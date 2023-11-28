import { __awaiter } from "tslib";
import { render, screen, act, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { DBClusterService } from '../__mocks__/DBCluster.service';
import { dbClustersStub } from '../__mocks__/dbClustersStubs';
import { DBClusterLogsModal } from './DBClusterLogsModal';
jest.mock('../DBCluster.service');
describe('DBClusterLogsModal::', () => {
    it('should render logs', () => __awaiter(void 0, void 0, void 0, function* () {
        act(() => {
            render(React.createElement(DBClusterLogsModal, { isVisible: true, setVisible: jest.fn(), dbCluster: dbClustersStub[0] }));
        });
        const logs = yield screen.findAllByTestId('dbcluster-pod-logs');
        expect(logs.length).toBeGreaterThan(0);
    }));
    it('should expand logs', () => __awaiter(void 0, void 0, void 0, function* () {
        act(() => {
            render(React.createElement(DBClusterLogsModal, { isVisible: true, setVisible: jest.fn(), dbCluster: dbClustersStub[0] }));
        });
        let preTags = screen.queryAllByTestId('dbcluster-pod-events');
        let logs = screen.queryAllByTestId('dbcluster-logs');
        expect(preTags).toHaveLength(0);
        expect(logs).toHaveLength(0);
        const actions = yield screen.findAllByTestId('dbcluster-logs-actions');
        const expandButton = within(actions[0]).getAllByRole('button')[0];
        act(() => {
            fireEvent.click(expandButton);
        });
        logs = yield screen.findAllByTestId('dbcluster-logs');
        expect(logs.length).toBeGreaterThan(0);
    }));
    it('should refresh logs', () => __awaiter(void 0, void 0, void 0, function* () {
        const getLogs = jest.fn();
        act(() => {
            render(React.createElement(DBClusterLogsModal, { isVisible: true, setVisible: jest.fn(), dbCluster: dbClustersStub[0] }));
        });
        DBClusterService.getLogs = getLogs();
        const actions = yield screen.findAllByTestId('dbcluster-logs-actions');
        const refreshButton = within(actions[0]).getAllByRole('button')[1];
        act(() => {
            fireEvent.click(refreshButton);
        });
        yield screen.findAllByTestId('dbcluster-logs-actions');
        expect(getLogs).toHaveBeenCalled();
    }));
});
//# sourceMappingURL=DBClusterLogsModal.test.js.map