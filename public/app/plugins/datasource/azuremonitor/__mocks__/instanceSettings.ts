import { DataSourceInstanceSettings, PluginType } from '@grafana/data';

import { AzureDataSourceInstanceSettings } from '../types';

import { DeepPartial, mapPartialArrayObject } from './utils';

export const createMockInstanceSetttings = (
  overrides?: DeepPartial<DataSourceInstanceSettings>
): AzureDataSourceInstanceSettings => {
  const metaOverrides = overrides?.meta;
  return {
    url: '/ds/1',
    id: 1,
    uid: 'abc',
    type: 'azuremonitor',
    access: 'proxy',
    name: 'azure',
    readOnly: false,
    ...overrides,
    meta: {
      id: 'grafana-azure-monitor-datasource',
      name: 'Azure Monitor',
      type: PluginType.datasource,
      module: 'path_to_module',
      baseUrl: 'base_url',
      ...metaOverrides,
      info: {
        description: 'Azure Monitor',
        updated: 'updated',
        version: '1.0.0',
        ...metaOverrides?.info,
        screenshots: mapPartialArrayObject(
          { name: 'Azure Screenshot', path: 'path_to_screenshot' },
          metaOverrides?.info?.screenshots
        ),
        links: mapPartialArrayObject(
          { name: 'Azure Link', url: 'link_url', target: '_blank' },
          metaOverrides?.info?.links
        ),
        author: {
          name: 'test',
          ...metaOverrides?.info?.author,
        },
        logos: {
          large: 'large.logo',
          small: 'small.logo',
          ...metaOverrides?.info?.logos,
        },
        build: {
          time: 0,
          repo: 'repo',
          branch: 'branch',
          hash: 'hash',
          number: 1,
          pr: 1,
          ...metaOverrides?.info?.build,
        },
      },
    },
    jsonData: {
      cloudName: 'azuremonitor',
      azureAuthType: 'clientsecret',

      // monitor
      tenantId: 'abc-123',
      clientId: 'def-456',
      subscriptionId: 'ghi-789',
      ...overrides?.jsonData,
    },
  };
};
