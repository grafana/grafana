import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { BackupMode, BackupStatus, DataModel } from 'app/percona/backup/Backup.types';
import { Databases } from 'app/percona/shared/core';
import { RestoreBackupModal } from './RestoreBackupModal';
describe('RestoreBackupModal', () => {
    const backup = {
        id: 'backup1',
        name: 'Backup 1',
        created: 1621956564096,
        locationId: 'location_1',
        locationName: 'Location One',
        serviceId: 'service_1',
        serviceName: 'Service One',
        dataModel: DataModel.PHYSICAL,
        status: BackupStatus.BACKUP_STATUS_SUCCESS,
        vendor: Databases.mongodb,
        mode: BackupMode.SNAPSHOT,
        folder: 'folder1',
    };
    it('should render', () => {
        render(React.createElement(RestoreBackupModal, { isVisible: true, backup: backup, onClose: jest.fn(), onRestore: jest.fn() }));
        expect(screen.getByTestId('restore-button')).toBeInTheDocument();
        expect(screen.getByTestId('restore-cancel-button')).toBeInTheDocument();
        expect(screen.getByTestId('backup-modal-error').textContent).toHaveLength(0);
    });
    it('should block restore button and show error when noService is passed and same service is selected', () => {
        render(React.createElement(RestoreBackupModal, { isVisible: true, noService: true, backup: backup, onClose: jest.fn(), onRestore: jest.fn() }));
        expect(screen.getByTestId('backup-modal-error').textContent).not.toHaveLength(0);
        expect(screen.getAllByTestId('restore-button')[0]).toBeDisabled();
    });
    it.skip('should not block restore button or show error when noService is passed and compatible service is selected', () => {
        render(React.createElement(RestoreBackupModal, { isVisible: true, noService: true, backup: backup, onClose: jest.fn(), onRestore: jest.fn() }));
        const rButton = screen.getAllByTestId('serviceType-radio-button')[0];
        fireEvent.change(rButton);
        expect(screen.getByTestId('backup-modal-error').textContent).toHaveLength(0);
        expect(screen.getAllByTestId('restore-button')[0]).not.toBeDisabled();
    });
});
//# sourceMappingURL=RestoreBackupModal.test.js.map