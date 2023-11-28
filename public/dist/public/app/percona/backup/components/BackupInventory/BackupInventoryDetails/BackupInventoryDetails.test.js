import { render, screen } from '@testing-library/react';
import React from 'react';
import { DataModel, BackupStatus } from 'app/percona/backup/Backup.types';
import { BackupInventoryDetails } from './BackupInventoryDetails';
describe('BackupInventoryDetails', () => {
    it('should have all fields', () => {
        render(React.createElement(BackupInventoryDetails, { name: "backup", status: BackupStatus.BACKUP_STATUS_PAUSED, dataModel: DataModel.LOGICAL, folder: "folder1" }));
        expect(screen.getByTestId('backup-artifact-details-name')).toBeInTheDocument();
        expect(screen.getByTestId('backup-artifact-details-data-model')).toBeInTheDocument();
        expect(screen.getByTestId('backup-artifact-details-folder')).toBeInTheDocument();
    });
});
//# sourceMappingURL=BackupInventoryDetails.test.js.map