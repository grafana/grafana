import { getTemplateSrv, TemplateSrv } from '@grafana/runtime';

import { resourceTypes } from '../azureMetadata/resourceTypes';
import Datasource from '../datasource';
import { AzureMonitorDataSourceInstanceSettings, AzureMonitorLocations } from '../types/types';

import { createMockInstanceSetttings } from './instanceSettings';
import { DeepPartial } from './utils';

export interface Context {
  instanceSettings: AzureMonitorDataSourceInstanceSettings;
  templateSrv: TemplateSrv;
  datasource: Datasource;
  getResource: jest.Mock;
}

export function createContext(overrides?: DeepPartial<Context>): Context {
  const instanceSettings = createMockInstanceSetttings(overrides?.instanceSettings);
  return {
    instanceSettings,
    templateSrv: getTemplateSrv(),
    datasource: new Datasource(instanceSettings),
    getResource: jest.fn(),
  };
}

export default function createMockDatasource(overrides?: DeepPartial<Datasource>) {
  // We make this a partial so we get _some_ kind of type safety when making this, rather than
  // having it be any or casted immediately to Datasource
  const _mockDatasource: DeepPartial<Datasource> = {
    getVariables: jest.fn().mockReturnValue([]),

    azureMonitorDatasource: {
      isConfigured() {
        return true;
      },
      getSubscriptions: jest.fn().mockResolvedValueOnce([]),
      defaultSubscriptionId: 'subscriptionId',
      getMetricNamespaces: jest.fn().mockResolvedValueOnce([]),
      getMetricNames: jest.fn().mockResolvedValueOnce([]),
      getMetricMetadata: jest.fn().mockResolvedValueOnce({
        primaryAggType: 'Average',
        supportedAggTypes: ['Average', 'Maximum', 'Minimum'],
        supportedTimeGrains: [],
        dimensions: [],
      }),
      getProvider: jest.fn().mockResolvedValueOnce({
        namespace: 'Microsoft.Insights',
        resourceTypes: [
          { resourceType: 'logs', locations: ['North Europe'], apiVersions: ['2022-11-11'], capabilities: '' },
        ],
      }),
      getLocations: jest
        .fn()
        .mockResolvedValue(
          new Map([['northeurope', { displayName: 'North Europe', name: 'northeurope', supportsLogs: false }]])
        ),
    },
    azureLogAnalyticsDatasource: {
      getKustoSchema: () => Promise.resolve(),
      getDeprecatedDefaultWorkSpace: () => 'defaultWorkspaceId',
      getBasicLogsQueryUsage: jest.fn(),
    },
    resourcePickerData: {
      getSubscriptions: () => jest.fn().mockResolvedValue([]),
      getResourceGroupsBySubscriptionId: jest.fn().mockResolvedValue([]),
      getResourcesForResourceGroup: jest.fn().mockResolvedValue([]),
      getResourceURIFromWorkspace: jest.fn().mockReturnValue(''),
      getResourceURIDisplayProperties: jest.fn().mockResolvedValue({}),
    },
    azureResourceGraphDatasource: {
      pagedResourceGraphRequest: jest.fn().mockResolvedValue([]),
      ...overrides?.azureResourceGraphDatasource,
    },
    getVariablesRaw: jest.fn().mockReturnValue([]),
    getDefaultSubscriptionId: jest.fn().mockReturnValue('defaultSubscriptionId'),
    getMetricNamespaces: jest.fn().mockResolvedValueOnce([]),
    getLocations: jest.fn().mockResolvedValueOnce([]),
    getAzureLogAnalyticsWorkspaces: jest.fn().mockResolvedValueOnce([]),
    getSubscriptions: jest.fn().mockResolvedValue([]),
    getResourceGroups: jest.fn().mockResolvedValueOnce([]),
    getResourceNames: jest.fn().mockResolvedValueOnce([]),
    currentUserAuth: false,
    ...overrides,
  };

  const mockDatasource = _mockDatasource as Datasource;

  return jest.mocked(mockDatasource);
}

export const createMockLocations = (): Promise<Map<string, AzureMonitorLocations>> => {
  return Promise.resolve(
    new Map<string, AzureMonitorLocations>([
      ['northeurope', { displayName: 'North Europe', name: 'northeurope', supportsLogs: true }],
      ['eastus', { displayName: 'East US', name: 'eastus', supportsLogs: true }],
    ])
  );
};
export const createMockMetricsNamespaces = (): Promise<
  Array<{
    text: string;
    value: string;
  }>
> => {
  return Promise.resolve(resourceTypes.map((type) => ({ text: type, value: type })));
};
