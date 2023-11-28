import { __awaiter } from "tslib";
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BackupStatus, RestoreStatus } from '../../Backup.types';
import { Status } from './Status';
import { Messages } from './Status.messages';
jest.mock('app/percona/shared/components/Elements/Icons', () => (Object.assign(Object.assign({}, jest.requireActual('app/percona/shared/components/Elements/Icons')), { Ellipsis: jest.fn(() => React.createElement("div", { "data-testid": "ellipsis" })) })));
describe('Status', () => {
    describe('pending states', () => {
        it('should show Ellipsis when backup is pending', () => {
            render(React.createElement(Status, { status: BackupStatus.BACKUP_STATUS_PENDING }));
            expect(screen.getByTestId('ellipsis')).toBeInTheDocument();
            expect(screen.queryByTestId('statusMsg')).not.toBeInTheDocument();
        });
        it('should show Ellipsis when backup is in progress', () => {
            render(React.createElement(Status, { status: BackupStatus.BACKUP_STATUS_IN_PROGRESS }));
            expect(screen.getByTestId('ellipsis')).toBeInTheDocument();
        });
        it('should show Ellipsis when restore is in progress', () => {
            render(React.createElement(Status, { status: RestoreStatus.RESTORE_STATUS_IN_PROGRESS }));
            expect(screen.getByTestId('ellipsis')).toBeInTheDocument();
        });
    });
    describe('not pending states', () => {
        it('should show message when not pending', () => {
            render(React.createElement(Status, { status: BackupStatus.BACKUP_STATUS_SUCCESS }));
            expect(screen.queryByTestId('ellipsis')).not.toBeInTheDocument();
            expect(screen.getByTestId('statusMsg')).toBeInTheDocument();
        });
        it('should show success icon when status is success', () => {
            render(React.createElement(Status, { status: BackupStatus.BACKUP_STATUS_SUCCESS }));
            expect(screen.getByTestId('success-icon')).toBeInTheDocument();
        });
        it('should show fail icon when status failed', () => {
            render(React.createElement(Status, { status: BackupStatus.BACKUP_STATUS_ERROR }));
            expect(screen.getByTestId('fail-icon')).toBeInTheDocument();
        });
        it('should show fail icon when status failed', () => {
            render(React.createElement(Status, { status: BackupStatus.BACKUP_STATUS_FAILED_NOT_SUPPORTED_BY_AGENT }));
            expect(screen.getByTestId('fail-icon')).toBeInTheDocument();
        });
        it('should show fail if unrecognized status', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(Status, { status: 'NO_ERROR' }));
            expect(screen.getByTestId('fail-icon')).toBeInTheDocument();
        }));
    });
    describe('logs action', () => {
        it('should have logs hidden by default', () => {
            render(React.createElement(Status, { status: BackupStatus.BACKUP_STATUS_IN_PROGRESS }));
            expect(screen.queryByText(Messages.logs)).not.toBeInTheDocument();
        });
        it('should call onLogClick', () => {
            const onLogClick = jest.fn();
            render(React.createElement(Status, { showLogsAction: true, status: BackupStatus.BACKUP_STATUS_IN_PROGRESS, onLogClick: onLogClick }));
            fireEvent.click(screen.queryByText(Messages.logs));
            expect(onLogClick).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=Status.test.js.map