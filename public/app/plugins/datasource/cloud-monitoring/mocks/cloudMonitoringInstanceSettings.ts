import type { DataSourceInstanceSettings, DataSourcePluginMeta } from '@grafana/data/types';
import { GoogleAuthType } from '@grafana/google-sdk';

import { type CloudMonitoringOptions } from '../types/types';

export const createMockInstanceSetttings = (
  overrides?: Partial<DataSourceInstanceSettings<CloudMonitoringOptions>>
): DataSourceInstanceSettings<CloudMonitoringOptions> => ({
  url: '/ds/1',
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
