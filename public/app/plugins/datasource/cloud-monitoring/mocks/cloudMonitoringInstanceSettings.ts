import { DataSourceInstanceSettings, DataSourcePluginMeta } from '@grafana/data';
import { GoogleAuthType } from '@grafana/google-sdk';

import { CloudMonitoringOptions } from '../types/types';

export const createMockInstanceSetttings = (
  overrides?: Partial<DataSourceInstanceSettings<CloudMonitoringOptions>>
): DataSourceInstanceSettings<CloudMonitoringOptions> => ({
  url: '/ds/1',
  id: 1,
  uid: 'abc',
  type: 'stackdriver',
  access: 'proxy',
  meta: {} as DataSourcePluginMeta,
  name: 'stackdriver',
  readOnly: false,

  jsonData: {
    authenticationType: GoogleAuthType.JWT,
    defaultProject: 'test-project',
    gceDefaultProject: 'test-project',
    clientEmail: 'test-email@test.com',
    tokenUri: 'https://oauth2.googleapis.com/token',
  },
  ...overrides,
});
