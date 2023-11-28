import { DataModel, RestoreStatus } from 'app/percona/backup/Backup.types';
import { Databases } from 'app/percona/shared/core';
export const stubs = [
    {
        id: 'restore_1',
        artifactId: 'backup_1',
        name: 'Restore 1',
        locationId: 'location_1',
        locationName: 'Location 1',
        started: 1615912580244,
        finished: 1615912580244,
        serviceId: 'service_1',
        serviceName: 'Service 1',
        dataModel: DataModel.LOGICAL,
        status: RestoreStatus.RESTORE_STATUS_SUCCESS,
        vendor: Databases.mysql,
    },
    {
        id: 'restore_2',
        artifactId: 'backup_2',
        name: 'Restore 2',
        locationId: 'location_2',
        locationName: 'Location 2',
        started: 1615912580244,
        finished: 1615912580244,
        serviceId: 'service_2',
        serviceName: 'Service 2',
        dataModel: DataModel.PHYSICAL,
        status: RestoreStatus.RESTORE_STATUS_IN_PROGRESS,
        vendor: Databases.mysql,
    },
];
export const RestoreHistoryService = jest.genMockFromModule('../RestoreHistory.service').RestoreHistoryService;
RestoreHistoryService.list = () => Promise.resolve(stubs);
//# sourceMappingURL=RestoreHistory.service.js.map