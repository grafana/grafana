import { SelectableValue } from '@grafana/data';
import { Databases } from 'app/percona/shared/core';

import * as service from '../AddBackupPage.service';
import { SelectableService } from '../AddBackupPage.types';

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

export const AddBackupPageService =
  jest.genMockFromModule<typeof service>('../AddBackupPage.service').AddBackupPageService;
AddBackupPageService.loadServiceOptions = () => Promise.resolve(serviceStubs);
