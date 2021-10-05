import { SelectableValue } from '@grafana/data';
import { Databases } from 'app/percona/shared/core';
import * as service from '../AddBackupModal.service';
import { SelectableService } from '../AddBackupModal.types';

export const serviceStubs: Array<SelectableValue<SelectableService>> = [
  {
    label: 'service_1',
    value: { id: 'Service 1', vendor: Databases.mongodb },
  },
  {
    label: 'service_2',
    value: { id: 'Service 2', vendor: Databases.mysql },
  },
];
export const locationsStubs: Array<SelectableValue<string>> = [
  {
    label: 'location_1',
    value: 'Location 1',
  },
  {
    label: 'location_2',
    value: 'Location 2',
  },
];

export const AddBackupModalService = jest.genMockFromModule<typeof service>('../AddBackupModal.service')
  .AddBackupModalService;
AddBackupModalService.loadServiceOptions = () => Promise.resolve(serviceStubs);
AddBackupModalService.loadLocationOptions = () => Promise.resolve(locationsStubs);
