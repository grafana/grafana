import React from 'react';
import { Backup } from '../BackupInventory.types';
import { RestoreBackupModal } from './RestoreBackupModal';
import { BackupMode, BackupStatus, DataModel } from 'app/percona/backup/Backup.types';
import { Databases } from 'app/percona/shared/core';
import { fireEvent, render, screen } from '@testing-library/react';

describe('RestoreBackupModal', () => {
  const backup: Backup = {
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
  };

  it('should render', () => {
    render(<RestoreBackupModal isVisible backup={backup} onClose={jest.fn()} onRestore={jest.fn()} />);
    expect(screen.getByTestId('restore-button')).toBeInTheDocument();
    expect(screen.getByTestId('restore-cancel-button')).toBeInTheDocument();
    expect(screen.getByTestId('backup-modal-error').textContent).toHaveLength(0);
  });

  it('should block restore button and show error when noService is passed and same service is selected', () => {
    render(<RestoreBackupModal isVisible noService backup={backup} onClose={jest.fn()} onRestore={jest.fn()} />);

    expect(screen.getByTestId('backup-modal-error').textContent).not.toHaveLength(0);
    expect(screen.getAllByTestId('restore-button')[0]).toBeDisabled();
  });

  it.skip('should not block restore button or show error when noService is passed and compatible service is selected', () => {
    render(<RestoreBackupModal isVisible noService backup={backup} onClose={jest.fn()} onRestore={jest.fn()} />);

    const rButton = screen.getAllByTestId('serviceType-radio-button')[0];
    fireEvent.change(rButton);

    expect(screen.getByTestId('backup-modal-error').textContent).toHaveLength(0);
    expect(screen.getAllByTestId('restore-button')[0]).not.toBeDisabled();
  });
});
