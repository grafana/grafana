import { render, screen } from '@testing-library/react';
import React from 'react';
import { DataModel } from 'app/percona/backup/Backup.types';
import { ScheduledBackupDetails } from './ScheduledBackupsDetails';
describe('ScheduledBackupsDetails', () => {
    it('should render', () => {
        render(React.createElement(ScheduledBackupDetails, { name: "Backup", description: "description", dataModel: DataModel.PHYSICAL, cronExpression: " * * * 1,3 0", folder: "folder1" }));
        expect(screen.getByTestId('scheduled-backup-details-wrapper')).toBeInTheDocument();
        expect(screen.getByTestId('scheduled-backup-details-name')).toBeInTheDocument();
        expect(screen.getByTestId('scheduled-backup-details-description')).toBeInTheDocument();
        expect(screen.getByTestId('scheduled-backup-details-cron')).toBeInTheDocument();
        expect(screen.getByTestId('scheduled-backup-details-data-model')).toBeInTheDocument();
        expect(screen.getByTestId('scheduled-backup-details-folder')).toBeInTheDocument();
    });
});
//# sourceMappingURL=ScheduledBackupsDetails.test.js.map