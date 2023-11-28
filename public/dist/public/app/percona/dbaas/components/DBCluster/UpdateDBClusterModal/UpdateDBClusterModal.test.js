import { __awaiter } from "tslib";
import { fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import { dataTestId } from 'app/percona/shared/helpers/utils';
import { dbClustersStub } from '../__mocks__/dbClustersStubs';
import { UpdateDBClusterModal } from './UpdateDBClusterModal';
jest.mock('../XtraDB.service');
describe('UpdateDBClusterModal::', () => {
    it('should render message with new database version', () => {
        var _a;
        const { container } = render(React.createElement(UpdateDBClusterModal, { dbCluster: dbClustersStub[0], isVisible: true, setVisible: jest.fn(), setLoading: jest.fn(), onUpdateFinished: jest.fn() }));
        const message = 'MySQL 5.6 to version 8.0 in dbcluster1';
        expect((_a = container.querySelector(dataTestId('update-dbcluster-message'))) === null || _a === void 0 ? void 0 : _a.textContent).toContain(message);
    });
    it('should call onUpdateFinished after update', () => __awaiter(void 0, void 0, void 0, function* () {
        const onUpdateFinished = jest.fn();
        const { container } = render(React.createElement(UpdateDBClusterModal, { dbCluster: dbClustersStub[0], isVisible: true, setVisible: jest.fn(), setLoading: jest.fn(), onUpdateFinished: onUpdateFinished }));
        const button = container.querySelector(dataTestId('confirm-update-dbcluster-button'));
        fireEvent.click(button);
        yield waitFor(() => expect(onUpdateFinished).toHaveBeenCalledTimes(1));
    }));
});
//# sourceMappingURL=UpdateDBClusterModal.test.js.map