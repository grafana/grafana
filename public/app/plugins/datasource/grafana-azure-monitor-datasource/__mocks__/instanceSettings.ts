import { DataSourcePluginMeta } from '@grafana/data';

import { AzureDataSourceInstanceSettings } from '../types';

export const createMockInstanceSetttings = (): AzureDataSourceInstanceSettings => ({
  url: '/ds/1',
  id: 1,
  uid: 'abc',
  type: 'azuremonitor',
  access: 'proxy',
  meta: {} as DataSourcePluginMeta,
  name: 'azure',
  readOnly: false,

  jsonData: {
    cloudName: 'azuremonitor',
    azureAuthType: 'clientsecret',

    // monitor
    tenantId: 'abc-123',
    clientId: 'def-456',
    subscriptionId: 'ghi-789',
  },
});
