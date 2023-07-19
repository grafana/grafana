import { DataSourceInstanceSettings } from '@grafana/data';
import { ContextSrv } from 'app/core/services/context_srv';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { TemplateSrv } from 'app/features/templating/template_srv';

import Datasource from '../datasource';
import { AzureDataSourceJsonData } from '../types';

import { createMockInstanceSetttings } from './instanceSettings';
import { DeepPartial } from './utils';

export interface Context {
  instanceSettings: DataSourceInstanceSettings<AzureDataSourceJsonData>;
  templateSrv: TemplateSrv;
  datasource: Datasource;
  getResource: jest.Mock;
}

export function createContext(overrides?: DeepPartial<Context>): Context {
  const instanceSettings = createMockInstanceSetttings(overrides?.instanceSettings);
  return {
    instanceSettings,
    templateSrv: new TemplateSrv(),
    datasource: new Datasource(instanceSettings),
    getResource: jest.fn(),
  };
}

const contextSrv = new ContextSrv();
const timeSrv = new TimeSrv(contextSrv);

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

    getAzureLogAnalyticsWorkspaces: jest.fn().mockResolvedValueOnce([]),

    getSubscriptions: jest.fn().mockResolvedValue([]),
    getResourceGroups: jest.fn().mockResolvedValueOnce([]),
    getResourceNames: jest.fn().mockResolvedValueOnce([]),

    azureLogAnalyticsDatasource: {
      getKustoSchema: () => Promise.resolve(),
      getDeprecatedDefaultWorkSpace: () => 'defaultWorkspaceId',
      timeSrv,
    },
    resourcePickerData: {
      getSubscriptions: () => jest.fn().mockResolvedValue([]),
      getResourceGroupsBySubscriptionId: jest.fn().mockResolvedValue([]),
      getResourcesForResourceGroup: jest.fn().mockResolvedValue([]),
      getResourceURIFromWorkspace: jest.fn().mockReturnValue(''),
      getResourceURIDisplayProperties: jest.fn().mockResolvedValue({}),
    },
    getVariablesRaw: jest.fn().mockReturnValue([]),
    ...overrides,
  };

  const mockDatasource = _mockDatasource as Datasource;

  return jest.mocked(mockDatasource);
}
