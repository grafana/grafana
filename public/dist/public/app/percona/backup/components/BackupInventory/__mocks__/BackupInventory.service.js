import { DataModel, BackupStatus, BackupMode } from 'app/percona/backup/Backup.types';
import { Databases } from 'app/percona/shared/core';
export const stubs = [
    {
        id: 'backup_1',
        name: 'Backup 1',
        locationId: 'location_1',
        locationName: 'Location 1',
        created: 1615912580244,
        serviceId: 'service_1',
        serviceName: 'Service 1',
        dataModel: DataModel.LOGICAL,
        status: BackupStatus.BACKUP_STATUS_SUCCESS,
        vendor: Databases.mysql,
        mode: BackupMode.SNAPSHOT,
        folder: 'folder1',
    },
    {
        id: 'backup_2',
        name: 'Backup 2',
        locationId: 'location_2',
        locationName: 'Location 2',
        created: 1615912580244,
        serviceId: 'service_2',
        serviceName: 'Service 2',
        dataModel: DataModel.PHYSICAL,
        status: BackupStatus.BACKUP_STATUS_IN_PROGRESS,
        vendor: Databases.mysql,
        mode: BackupMode.SNAPSHOT,
        folder: 'folder1',
    },
];
export const BackupInventoryService = jest.genMockFromModule('../BackupInventory.service').BackupInventoryService;
BackupInventoryService.list = () => Promise.resolve(stubs);
//# sourceMappingURL=BackupInventory.service.js.map