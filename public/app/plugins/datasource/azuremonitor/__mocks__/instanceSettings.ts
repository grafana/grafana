import { DataSourceInstanceSettings, DataSourcePluginMeta } from '@grafana/data';

import { AzureDataSourceInstanceSettings, AzureDataSourceJsonData } from '../types';

export const createMockInstanceSetttings = (
  overrides?: Partial<DataSourceInstanceSettings>,
  jsonDataOverrides?: Partial<AzureDataSourceJsonData>
): AzureDataSourceInstanceSettings => ({
  url: '/ds/1',
  id: 1,
  uid: 'abc',
  type: 'azuremonitor',
  access: 'proxy',
  meta: {} as DataSourcePluginMeta,
  name: 'azure',
  readOnly: false,
  ...overrides,

  jsonData: {
    cloudName: 'azuremonitor',
    azureAuthType: 'clientsecret',

    // monitor
    tenantId: 'abc-123',
    clientId: 'def-456',
    subscriptionId: 'ghi-789',
    ...jsonDataOverrides,
  },
});
