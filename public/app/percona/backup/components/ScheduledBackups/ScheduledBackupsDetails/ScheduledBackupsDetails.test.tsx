import React from 'react';
import { ScheduledBackupDetails } from './ScheduledBackupsDetails';
import { DataModel } from 'app/percona/backup/Backup.types';
import { render, screen } from '@testing-library/react';

describe('ScheduledBackupsDetails', () => {
  it('should render', () => {
    render(
      <ScheduledBackupDetails
        name="Backup"
        description="description"
        dataModel={DataModel.PHYSICAL}
        cronExpression=" * * * 1,3 0"
      />
    );
    expect(screen.getByTestId('scheduled-backup-details-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('scheduled-backup-details-name')).toBeInTheDocument();
    expect(screen.getByTestId('scheduled-backup-details-description')).toBeInTheDocument();
    expect(screen.getByTestId('scheduled-backup-details-cron')).toBeInTheDocument();
    expect(screen.getByTestId('scheduled-backup-details-data-model')).toBeInTheDocument();
    expect(screen.getByTestId('scheduled-backup-details-data-model')).toBeInTheDocument();
  });
});
