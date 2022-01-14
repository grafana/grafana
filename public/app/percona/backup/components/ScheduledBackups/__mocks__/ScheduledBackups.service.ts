import { BackupType, DataModel } from 'app/percona/backup/Backup.types';
import { Databases } from 'app/percona/shared/core';
import * as service from '../ScheduledBackups.service';
import { ScheduledBackup } from '../ScheduledBackups.types';

export const stubs: ScheduledBackup[] = [
  {
    id: 'backup_1',
    name: 'Backup 1',
    locationId: 'location_1',
    locationName: 'Location 1',
    serviceId: 'service_1',
    serviceName: 'Service 1',
    vendor: Databases.mysql,
    start: 1623424776147,
    retention: 0,
    cronExpression: '30 00 * * *',
    lastBackup: 1623424776147,
    dataModel: DataModel.PHYSICAL,
    description: 'Description',
    type: BackupType.FULL,
    enabled: true,
  },
  {
    id: 'backup_2',
    name: 'Backup 2',
    locationId: 'location_2',
    locationName: 'Location 2',
    serviceId: 'service_2',
    serviceName: 'Service 2',
    vendor: Databases.mysql,
    start: 1623424776147,
    retention: 0,
    cronExpression: '15 00 * * *',
    lastBackup: 1623424776147,
    dataModel: DataModel.LOGICAL,
    description: 'Description',
    type: BackupType.FULL,
    enabled: true,
  },
];

export const ScheduledBackupsService = jest.genMockFromModule<typeof service>('../ScheduledBackups.service')
  .ScheduledBackupsService;
ScheduledBackupsService.list = () => Promise.resolve(stubs);
