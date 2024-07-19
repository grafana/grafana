import { KeyValue } from '@grafana/data';

import { AzureDataSourceSettings } from '../types';

import { DeepPartial } from './utils';

export const createMockDatasourceSettings = (
  overrides?: DeepPartial<AzureDataSourceSettings>,
  secureJsonFieldsOverrides?: KeyValue<boolean>
): AzureDataSourceSettings => {
  return {
    id: 1,
    uid: 'uid',
    orgId: 1,
    name: 'test-data-source',
    typeLogoUrl: 'logo',
    type: 'grafana-azure-monitor-datasource',
    typeName: 'datasource',
    access: '',
    url: '',
    user: '',
    database: '',
    basicAuth: false,
    basicAuthUser: '',
    isDefault: false,
    jsonData: {
      cloudName: 'azuremonitor',
      azureAuthType: 'clientsecret',

      tenantId: 'abc-123',
      clientId: 'def-456',
      subscriptionId: 'ghi-789',
      ...overrides?.jsonData,
    },
    secureJsonData: { ...overrides?.secureJsonData },
    secureJsonFields: { ...secureJsonFieldsOverrides },
    readOnly: false,
    withCredentials: false,
  };
};
