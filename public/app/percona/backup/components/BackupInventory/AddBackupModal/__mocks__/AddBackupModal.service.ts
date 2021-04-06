import { SelectableValue } from '@grafana/data';
import * as service from '../AddBackupModal.service';

export const serviceStubs: Array<SelectableValue<string>> = [
  {
    label: 'service_1',
    value: 'Service 1',
  },
  {
    label: 'service_2',
    value: 'Service 2',
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
