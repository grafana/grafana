import { Backup, DataModel, Status } from '../BackupInventory.types';
import { Databases } from 'app/percona/shared/core';
import * as service from '../BackupInventory.service';

export const stubs: Backup[] = [
  {
    id: 'backup_1',
    name: 'Backup 1',
    locationId: 'location_1',
    locationName: 'Location 1',
    created: 1615912580244,
    serviceId: 'service_1',
    serviceName: 'Service 1',
    dataModel: DataModel.LOGICAL,
    status: Status.SUCCESS,
    vendor: Databases.mysql,
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
    status: Status.IN_PROGRESS,
    vendor: Databases.mysql,
  },
];

export const BackupInventoryService = jest.genMockFromModule<typeof service>('../BackupInventory.service')
  .BackupInventoryService;
BackupInventoryService.list = () => Promise.resolve(stubs);
