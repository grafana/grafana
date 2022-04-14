import React from 'react';
import { BackupInventoryDetails } from './BackupInventoryDetails';
import { DataModel, BackupStatus } from 'app/percona/backup/Backup.types';
import { render, screen } from '@testing-library/react';

describe('BackupInventoryDetails', () => {
  it('should have all fields', () => {
    render(
      <BackupInventoryDetails name="backup" status={BackupStatus.BACKUP_STATUS_PAUSED} dataModel={DataModel.LOGICAL} />
    );
    expect(screen.getByTestId('backup-artifact-details-name')).toBeInTheDocument();
    expect(screen.getByTestId('backup-artifact-details-data-model')).toBeInTheDocument();
  });
});
