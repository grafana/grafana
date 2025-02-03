import { get, set } from 'lodash';

import { ScopedVars } from '@grafana/data';
import { VariableInterpolation } from '@grafana/runtime';

import createMockQuery from '../__mocks__/query';
import { createTemplateVariables } from '../__mocks__/utils';
import { multiVariable } from '../__mocks__/variables';
import AzureMonitorDatasource from '../datasource';
import { AzureAPIResponse, AzureMonitorDataSourceInstanceSettings, Location } from '../types';

// We want replace to just return the value as is in general/
// We declare this as a function so that we can overwrite it in each test
// without affecting the rest of the @grafana/runtime module.
let replace = (val: string) => val;

jest.mock('@grafana/runtime', () => {
  return {
    __esModule: true,
    ...jest.requireActual('@grafana/runtime'),
    getTemplateSrv: () => ({
      replace: replace,
      getVariables: jest.fn(),
      updateTimeRange: jest.fn(),
      containsTemplate: jest.fn(),
    }),
  };
});

interface TestContext {
  instanceSettings: AzureMonitorDataSourceInstanceSettings;
  ds: AzureMonitorDatasource;
}

describe('AzureMonitorDatasource', () => {
  const ctx: TestContext = {} as TestContext;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx.instanceSettings = {
      name: 'test',
      url: 'http://azuremonitor.com',
      jsonData: { subscriptionId: 'mock-subscription-id', cloudName: 'azuremonitor' },
    } as unknown as AzureMonitorDataSourceInstanceSettings;
    ctx.ds = new AzureMonitorDatasource(ctx.instanceSettings);
  });

  describe('filterQuery', () => {
    [
      {
        description: 'filter query all props',
        query: createMockQuery(),
        filtered: true,
      },
      {
        description: 'filter query with no resourceGroup',
        query: createMockQuery({ azureMonitor: { resources: [{ resourceGroup: undefined }] } }),
        filtered: false,
      },
      {
        description: 'filter query with no resourceName',
        query: createMockQuery({ azureMonitor: { resources: [{ resourceName: undefined }] } }),
        filtered: false,
      },
      {
        description: 'filter query with no metricNamespace',
        query: createMockQuery({ azureMonitor: { metricNamespace: undefined } }),
        filtered: false,
      },
      {
        description: 'filter query with no metricName',
        query: createMockQuery({ azureMonitor: { metricName: undefined } }),
        filtered: false,
      },
      {
        description: 'filter query with no aggregation',
        query: createMockQuery({ azureMonitor: { aggregation: undefined } }),
        filtered: false,
      },
      {
        description: 'filter hidden query',
        query: createMockQuery({ hide: true }),
        filtered: false,
      },
    ].forEach((t) => {
      it(t.description, () => {
        expect(ctx.ds.filterQuery(t.query)).toEqual(t.filtered);
      });
    });
  });

  describe('applyTemplateVariables', () => {
    beforeEach(() => {
      replace = (target?: string) => target || '';
      ctx.ds = new AzureMonitorDatasource(ctx.instanceSettings);
    });

    it('should migrate metricDefinition to metricNamespace', () => {
      const query = createMockQuery({
        azureMonitor: {
          metricNamespace: undefined,
          metricDefinition: 'microsoft.insights/components',
        },
      });
      const templatedQuery = ctx.ds.azureMonitorDatasource.applyTemplateVariables(query, {});
      expect(templatedQuery).toMatchObject({
        azureMonitor: {
          metricNamespace: 'microsoft.insights/components',
        },
      });
    });

    it('should migrate resource URI template variable to resource object', () => {
      const subscription = '44693801-6ee6-49de-9b2d-9106972f9572';
      const resourceGroup = 'cloud-datasources';
      const metricNamespace = 'microsoft.insights/components';
      const resourceName = 'AppInsightsTestData';
      replace = (target?: string) => {
        if (target?.includes('$resourceUri')) {
          return `/subscriptions/${subscription}/resourceGroups/${resourceGroup}/providers/${metricNamespace}/${resourceName}`;
        }
        return target || '';
      };
      ctx.ds = new AzureMonitorDatasource(ctx.instanceSettings);

      const query = createMockQuery({
        azureMonitor: {
          resourceUri: '$resourceUri',
        },
      });
      const templatedQuery = ctx.ds.azureMonitorDatasource.applyTemplateVariables(query, {});
      expect(templatedQuery).toMatchObject({
        subscription,
        azureMonitor: {
          metricNamespace,
          resources: [{ resourceGroup, resourceName }],
        },
      });
    });

    it('expand template variables in resource groups and names', () => {
      const resourceGroup = '$rg';
      const resourceName = '$rn';
      replace = (
        target?: string,
        _scopedVars?: ScopedVars,
        _format?: string | Function,
        interpolated?: VariableInterpolation[]
      ) => {
        if (target?.includes('$rg')) {
          if (interpolated) {
            interpolated.push({ value: 'rg1,rg2', match: '$rg', variableName: 'rg' });
          }
          return 'rg1,rg2';
        }
        if (target?.includes('$rn')) {
          if (interpolated) {
            interpolated.push({ value: 'rn1,rn2', match: '$rn', variableName: 'rn' });
          }
          return 'rn1,rn2';
        }
        return target || '';
      };
      ctx.ds = new AzureMonitorDatasource(ctx.instanceSettings);
      const query = createMockQuery({
        azureMonitor: {
          resources: [{ resourceGroup, resourceName }],
        },
      });
      const templatedQuery = ctx.ds.azureMonitorDatasource.applyTemplateVariables(query, {});
      expect(templatedQuery).toMatchObject({
        azureMonitor: {
          resources: [
            { resourceGroup: 'rg1', resourceName: 'rn1' },
            { resourceGroup: 'rg2', resourceName: 'rn1' },
            { resourceGroup: 'rg1', resourceName: 'rn2' },
            { resourceGroup: 'rg2', resourceName: 'rn2' },
          ],
        },
      });
    });

    it('expand template variables in more complex resource groups and names', () => {
      const resourceGroup = 'test-$rg-testGroup';
      const resourceName = 'test-$rn-testResource';
      replace = (
        target?: string,
        _scopedVars?: ScopedVars,
        _format?: string | Function,
        interpolated?: VariableInterpolation[]
      ) => {
        if (target?.includes('$rg')) {
          if (interpolated) {
            interpolated.push({ value: 'rg1,rg2', match: '$rg', variableName: 'rg' });
          }
          return 'rg1,rg2';
        }
        if (target?.includes('$rn')) {
          if (interpolated) {
            interpolated.push({ value: 'rn1,rn2', match: '$rn', variableName: 'rn' });
          }
          return 'rn1,rn2';
        }
        return target || '';
      };
      ctx.ds = new AzureMonitorDatasource(ctx.instanceSettings);
      const query = createMockQuery({
        azureMonitor: {
          resources: [{ resourceGroup, resourceName }],
        },
      });
      const templatedQuery = ctx.ds.azureMonitorDatasource.applyTemplateVariables(query, {});
      expect(templatedQuery).toMatchObject({
        azureMonitor: {
          resources: [
            { resourceGroup: 'test-rg1-testGroup', resourceName: 'test-rn1-testResource' },
            { resourceGroup: 'test-rg2-testGroup', resourceName: 'test-rn1-testResource' },
            { resourceGroup: 'test-rg1-testGroup', resourceName: 'test-rn2-testResource' },
            { resourceGroup: 'test-rg2-testGroup', resourceName: 'test-rn2-testResource' },
          ],
        },
      });
    });

    it('expand template variables for a region', () => {
      const region = '$reg';
      replace = (target?: string) => {
        if (target?.includes('$reg')) {
          return 'eastus';
        }
        return target || '';
      };
      ctx.ds = new AzureMonitorDatasource(ctx.instanceSettings);

      const query = createMockQuery({
        azureMonitor: {
          region,
        },
      });
      const templatedQuery = ctx.ds.azureMonitorDatasource.applyTemplateVariables(query, {});
      expect(templatedQuery).toMatchObject({
        azureMonitor: {
          region: 'eastus',
        },
      });
    });

    it('should migrate legacy properties before interpolation', () => {
      replace = (target?: string) => {
        if (target?.includes('$resourcegroup')) {
          return 'test-rg';
        }
        if (target?.includes('$resourcename')) {
          return 'test-resource';
        }
        if (target?.includes('$metric')) {
          return 'test-ns';
        }
        return target || '';
      };
      ctx.ds = new AzureMonitorDatasource(ctx.instanceSettings);

      const query = createMockQuery({
        azureMonitor: {
          metricDefinition: '$metric',
          resourceGroup: '$resourcegroup',
          resourceName: '$resourcename',
          metricNamespace: undefined,
        },
      });
      const templatedQuery = ctx.ds.azureMonitorDatasource.applyTemplateVariables(query, {});
      expect(templatedQuery).toMatchObject({
        azureMonitor: {
          metricNamespace: 'test-ns',
          resources: [{ resourceGroup: 'test-rg', resourceName: 'test-resource' }],
        },
      });
    });
  });

  describe('When performing getMetricNamespaces', () => {
    const response = {
      value: [
        {
          id: '/subscriptions/mock-subscription-id/resourceGroups/nodeapp/providers/microsoft.insights/components/resource1/providers/microsoft.insights/metricNamespaces/Azure.ApplicationInsights',
          name: 'Azure.ApplicationInsights',
          type: 'Microsoft.Insights/metricNamespaces',
          classification: 'Custom',
          properties: {
            metricNamespaceName: 'Azure.ApplicationInsights',
          },
        },
        {
          id: '/subscriptions/mock-subscription-id/resourceGroups/nodeapp/providers/microsoft.insights/components/resource1/providers/microsoft.insights/metricNamespaces/microsoft.insights-components',
          name: 'microsoft.insights-components',
          type: 'Microsoft.Insights/metricNamespaces',
          classification: 'Platform',
          properties: {
            metricNamespaceName: 'microsoft.insights/components',
          },
        },
      ],
    };

    beforeEach(() => {
      ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation((path: string) => {
        if (path.includes('westeurope')) {
          return Promise.reject('failed to retrieve due to timeout');
        }
        const basePath = 'azuremonitor/subscriptions/mock-subscription-id/resourceGroups/nodeapp';
        const expected =
          basePath +
          '/providers/microsoft.insights/components/resource1/providers/microsoft.insights/metricNamespaces?api-version=2017-12-01-preview' +
          (path.includes('&region=global') ? '&region=global' : '');
        expect(path).toBe(expected);
        return Promise.resolve(response);
      });
    });

    it('should return list of Metric Namspaces', () => {
      return ctx.ds.azureMonitorDatasource
        .getMetricNamespaces(
          {
            resourceUri:
              '/subscriptions/mock-subscription-id/resourceGroups/nodeapp/providers/microsoft.insights/components/resource1',
          },
          true
        )
        .then((results: Array<{ text: string; value: string }>) => {
          expect(results.length).toEqual(2);
          expect(results[0].text).toEqual('Azure.ApplicationInsights');
          expect(results[0].value).toEqual('Azure.ApplicationInsights');
          expect(results[1].text).toEqual('microsoft.insights/components');
          expect(results[1].value).toEqual('microsoft.insights/components');
        });
    });

    it('should return list of Metric Namespaces even if there is a failure', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      return ctx.ds.azureMonitorDatasource
        .getMetricNamespaces(
          {
            resourceUri:
              '/subscriptions/mock-subscription-id/resourceGroups/nodeapp/providers/microsoft.insights/components/resource1',
          },
          true,
          'westeurope'
        )
        .then((results: Array<{ text: string; value: string }>) => {
          expect(results.length).toEqual(0);
          expect(consoleError).toHaveBeenCalled();
          expect(consoleError.mock.calls[0][0]).toContain(
            'Failed to get metric namespaces: failed to retrieve due to timeout'
          );
        });
    });

    it('when custom is specified will only return custom namespaces', () => {
      return ctx.ds.azureMonitorDatasource
        .getMetricNamespaces(
          {
            resourceUri:
              '/subscriptions/mock-subscription-id/resourceGroups/nodeapp/providers/microsoft.insights/components/resource1',
          },
          false,
          undefined,
          true
        )
        .then((results: Array<{ text: string; value: string }>) => {
          expect(results.length).toEqual(1);
          expect(results[0].text).toEqual('Azure.ApplicationInsights');
          expect(results[0].value).toEqual('Azure.ApplicationInsights');
        });
    });
  });

  describe('When performing getMetricNames', () => {
    const response = {
      value: [
        {
          name: {
            value: 'UsedCapacity',
            localizedValue: 'Used capacity',
          },
          unit: 'CountPerSecond',
          primaryAggregationType: 'Total',
          supportedAggregationTypes: ['None', 'Average', 'Minimum', 'Maximum', 'Total', 'Count'],
          metricAvailabilities: [
            { timeGrain: 'PT1H', retention: 'P93D' },
            { timeGrain: 'PT6H', retention: 'P93D' },
            { timeGrain: 'PT12H', retention: 'P93D' },
            { timeGrain: 'P1D', retention: 'P93D' },
          ],
        },
        {
          name: {
            value: 'FreeCapacity',
            localizedValue: 'Free capacity',
          },
          unit: 'CountPerSecond',
          primaryAggregationType: 'Average',
          supportedAggregationTypes: ['None', 'Average'],
          metricAvailabilities: [
            { timeGrain: 'PT1H', retention: 'P93D' },
            { timeGrain: 'PT6H', retention: 'P93D' },
            { timeGrain: 'PT12H', retention: 'P93D' },
            { timeGrain: 'P1D', retention: 'P93D' },
          ],
        },
      ],
    };

    it('should return list of Metric Names', () => {
      ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation((path: string) => {
        const basePath = 'azuremonitor/subscriptions/mock-subscription-id/resourceGroups/nodeapp';
        const expected =
          basePath +
          '/providers/microsoft.insights/components/resource1' +
          '/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01';
        expect(path).toBe(expected);
        return Promise.resolve(response);
      });
      return ctx.ds.azureMonitorDatasource
        .getMetricNames({
          resourceUri:
            '/subscriptions/mock-subscription-id/resourceGroups/nodeapp/providers/microsoft.insights/components/resource1',
          metricNamespace: 'microsoft.insights/components',
        })
        .then((results: Array<{ text: string; value: string }>) => {
          expect(results.length).toEqual(2);
          expect(results[0].text).toEqual('Used capacity');
          expect(results[0].value).toEqual('UsedCapacity');
          expect(results[1].text).toEqual('Free capacity');
          expect(results[1].value).toEqual('FreeCapacity');
        });
    });

    it('should return list of Metric Names appropriate when multiple resources are selected', () => {
      ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation((path: string) => {
        const basePath = 'azuremonitor/subscriptions/mock-subscription-id/resourceGroups/nodeapp';
        const expected =
          basePath +
          '/providers/microsoft.insights/metricdefinitions?api-version=2017-12-01-preview&metricnamespace=microsoft.insights%2Fcomponents&region=region';
        expect(path).toBe(expected);
        return Promise.resolve(response);
      });
      return ctx.ds.azureMonitorDatasource
        .getMetricNames(
          {
            resourceUri: '/subscriptions/mock-subscription-id/resourceGroups/nodeapp',
            metricNamespace: 'microsoft.insights/components',
          },
          true,
          'region'
        )
        .then((results: Array<{ text: string; value: string }>) => {
          expect(results.length).toEqual(2);
          expect(results[0].text).toEqual('Used capacity');
          expect(results[0].value).toEqual('UsedCapacity');
          expect(results[1].text).toEqual('Free capacity');
          expect(results[1].value).toEqual('FreeCapacity');
        });
    });
  });

  describe('When performing getMetricMetadata', () => {
    const response = {
      value: [
        {
          name: {
            value: 'UsedCapacity',
            localizedValue: 'Used capacity',
          },
          unit: 'CountPerSecond',
          primaryAggregationType: 'Total',
          supportedAggregationTypes: ['None', 'Average', 'Minimum', 'Maximum', 'Total', 'Count'],
          metricAvailabilities: [
            { timeGrain: 'PT1H', retention: 'P93D' },
            { timeGrain: 'PT6H', retention: 'P93D' },
            { timeGrain: 'PT12H', retention: 'P93D' },
            { timeGrain: 'P1D', retention: 'P93D' },
          ],
        },
        {
          name: {
            value: 'FreeCapacity',
            localizedValue: 'Free capacity',
          },
          unit: 'CountPerSecond',
          primaryAggregationType: 'Average',
          supportedAggregationTypes: ['None', 'Average'],
          metricAvailabilities: [
            { timeGrain: 'PT1H', retention: 'P93D' },
            { timeGrain: 'PT6H', retention: 'P93D' },
            { timeGrain: 'PT12H', retention: 'P93D' },
            { timeGrain: 'P1D', retention: 'P93D' },
          ],
        },
      ],
    };

    beforeEach(() => {
      ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation((path: string) => {
        const basePath = 'azuremonitor/subscriptions/mock-subscription-id/resourceGroups/nodeapp';
        const expected =
          basePath +
          '/providers/microsoft.insights/components/resource1' +
          '/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01';
        expect(path).toBe(expected);
        return Promise.resolve(response);
      });
    });

    it('should return Aggregation metadata for a Metric', () => {
      return ctx.ds.azureMonitorDatasource
        .getMetricMetadata({
          resourceUri:
            '/subscriptions/mock-subscription-id/resourceGroups/nodeapp/providers/microsoft.insights/components/resource1',
          metricNamespace: 'microsoft.insights/components',
          metricName: 'UsedCapacity',
        })
        .then((results) => {
          expect(results.primaryAggType).toEqual('Total');
          expect(results.supportedAggTypes.length).toEqual(6);
          expect(results.supportedTimeGrains.length).toEqual(5); // 4 time grains from the API + auto
        });
    });

    it('should replace a template variable for the metric name', () => {
      replace = (target?: string) => {
        if (target?.includes('$metric')) {
          return 'UsedCapacity';
        }
        return target || '';
      };
      ctx.ds = new AzureMonitorDatasource(ctx.instanceSettings);
      ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation((path: string) => {
        const basePath = 'azuremonitor/subscriptions/mock-subscription-id/resourceGroups/nodeapp';
        const expected =
          basePath +
          '/providers/microsoft.insights/components/resource1' +
          '/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01';
        expect(path).toBe(expected);
        return Promise.resolve(response);
      });

      return ctx.ds.azureMonitorDatasource
        .getMetricMetadata({
          resourceUri:
            '/subscriptions/mock-subscription-id/resourceGroups/nodeapp/providers/microsoft.insights/components/resource1',
          metricNamespace: 'microsoft.insights/components',
          metricName: '$metric',
        })
        .then((results) => {
          expect(results.primaryAggType).toEqual('Total');
          expect(results.supportedAggTypes.length).toEqual(6);
          expect(results.supportedTimeGrains.length).toEqual(5); // 4 time grains from the API + auto
        });
    });
  });

  describe('When performing interpolateVariablesInQueries for azure_monitor_metrics', () => {
    beforeEach(() => {
      replace = (target?: string) => target || '';
      ctx.ds = new AzureMonitorDatasource(ctx.instanceSettings);
    });

    it('should return a query unchanged if no template variables are provided', () => {
      const query = createMockQuery();
      const templatedQuery = ctx.ds.interpolateVariablesInQueries([query], {});
      expect(templatedQuery[0]).toEqual(query);
    });

    it('should return a query with any template variables replaced', () => {
      const templateableProps = [
        'resources[0].resourceGroup',
        'resources[0].resourceName',
        'metricNamespace',
        'timeGrain',
        'aggregation',
        'top',
        'dimensionFilters[0].dimension',
        'dimensionFilters[0].filters[0]',
      ];
      const templateVariables = createTemplateVariables(templateableProps);
      replace = (target?: string) => {
        if (target === '$resources0resourceGroup') {
          return 'resources0resourceGroup-template-variable';
        }
        if (target === '$resources0resourceName') {
          return 'resources0resourceName-template-variable';
        }
        if (target === '$metricNamespace') {
          return 'metricNamespace-template-variable';
        }
        if (target === '$timeGrain') {
          return 'timeGrain-template-variable';
        }
        if (target === '$aggregation') {
          return 'aggregation-template-variable';
        }
        if (target === '$top') {
          return 'top-template-variable';
        }
        if (target === '$dimensionFilters0dimension') {
          return 'dimensionFilters0dimension-template-variable';
        }
        if (target === '$dimensionFilters0filters0') {
          return 'dimensionFilters0filters0-template-variable';
        }
        return target || '';
      };
      ctx.ds = new AzureMonitorDatasource(ctx.instanceSettings);

      const query = createMockQuery();
      const azureMonitorQuery = {};
      for (const [path, templateVariable] of templateVariables.entries()) {
        set(azureMonitorQuery, path, `$${templateVariable.variableName}`);
      }

      query.azureMonitor = {
        ...query.azureMonitor,
        ...azureMonitorQuery,
      };
      const templatedQuery = ctx.ds.interpolateVariablesInQueries([query], {});
      expect(templatedQuery[0]).toHaveProperty('datasource');
      for (const [path, templateVariable] of templateVariables.entries()) {
        expect(get(templatedQuery[0].azureMonitor, path)).toEqual(templateVariable.templateVariable.current.value);
      }
    });
  });

  describe('When performing getLocations', () => {
    const sub1Response: AzureAPIResponse<Location> = {
      value: [
        {
          id: '/subscriptions/mock-subscription-id-1/locations/northeurope',
          name: 'northeurope',
          displayName: 'North Europe',
          regionalDisplayName: '(Europe) North Europe',
          metadata: {
            regionType: 'Physical',
            regionCategory: 'Recommended',
            geographyGroup: 'EU',
            longitude: '-0',
            latitude: '0',
            physicalLocation: 'Europe',
            pairedRegion: [],
          },
        },
      ],
    };

    const sub2Response: AzureAPIResponse<Location> = {
      value: [
        {
          id: '/subscriptions/mock-subscription-id-2/locations/eastus2',
          name: 'eastus2',
          displayName: 'East US 2',
          regionalDisplayName: '(US) East US 2',
          metadata: {
            regionType: 'Physical',
            regionCategory: 'Recommended',
            geographyGroup: 'US',
            longitude: '-0',
            latitude: '0',
            physicalLocation: 'US',
            pairedRegion: [],
          },
        },
      ],
    };

    beforeEach(() => {
      ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation((path: string) => {
        const expectedPaths = [1, 2].map(
          (sub) => `azuremonitor/subscriptions/mock-subscription-id-${sub}/locations?api-version=2020-01-01`
        );
        expect(expectedPaths).toContain(path);
        if (path.includes('mock-subscription-id-1')) {
          return Promise.resolve(sub1Response);
        } else {
          return Promise.resolve(sub2Response);
        }
      });
    });

    it('should return a locations map', async () => {
      const result = await ctx.ds.azureMonitorDatasource.getLocations(['mock-subscription-id-1']);

      expect(result.size).toBe(1);
      expect(result.has('northeurope')).toBe(true);
      expect(result.get('northeurope')?.name).toBe('northeurope');
      expect(result.get('northeurope')?.displayName).toBe('North Europe');
      expect(result.get('northeurope')?.supportsLogs).toBe(undefined);
    });

    it('should return a locations map with locations deduped', async () => {
      const result = await ctx.ds.azureMonitorDatasource.getLocations([
        'mock-subscription-id-1',
        'mock-subscription-id-2',
      ]);

      expect(result.size).toBe(2);
      expect(result.has('northeurope')).toBe(true);
      expect(result.get('northeurope')?.name).toBe('northeurope');
      expect(result.get('northeurope')?.displayName).toBe('North Europe');
      expect(result.get('northeurope')?.supportsLogs).toBe(undefined);
      expect(result.has('eastus2')).toBe(true);
      expect(result.get('eastus2')?.name).toBe('eastus2');
      expect(result.get('eastus2')?.displayName).toBe('East US 2');
      expect(result.get('eastus2')?.supportsLogs).toBe(undefined);
    });
  });

  describe('Legacy Azure Monitor Query Object data fetchers', () => {
    describe('When performing getSubscriptions', () => {
      const response = {
        value: [
          {
            id: '/subscriptions/99999999-cccc-bbbb-aaaa-9106972f9572',
            subscriptionId: '99999999-cccc-bbbb-aaaa-9106972f9572',
            tenantId: '99999999-aaaa-bbbb-cccc-51c4f982ec48',
            displayName: 'Primary Subscription',
            state: 'Enabled',
            subscriptionPolicies: {
              locationPlacementId: 'Public_2014-09-01',
              quotaId: 'PayAsYouGo_2014-09-01',
              spendingLimit: 'Off',
            },
            authorizationSource: 'RoleBased',
          },
        ],
        count: {
          type: 'Total',
          value: 1,
        },
      };

      beforeEach(() => {
        ctx.instanceSettings.jsonData.azureAuthType = 'msi';
        ctx.ds = new AzureMonitorDatasource(ctx.instanceSettings);
        ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockResolvedValue(response);
      });

      it('should return list of subscriptions', () => {
        return ctx.ds.getSubscriptions().then((results: Array<{ text: string; value: string }>) => {
          expect(results.length).toEqual(1);
          expect(results[0].text).toEqual('Primary Subscription');
          expect(results[0].value).toEqual('99999999-cccc-bbbb-aaaa-9106972f9572');
        });
      });
    });

    describe('When performing getResourceGroups', () => {
      const response = {
        value: [{ name: 'grp1' }, { name: 'grp2' }],
      };

      beforeEach(() => {
        ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockResolvedValue(response);
      });

      it('should return list of Resource Groups', () => {
        return ctx.ds.getResourceGroups('subscriptionId').then((results: Array<{ text: string; value: string }>) => {
          expect(results.length).toEqual(2);
          expect(results[0].text).toEqual('grp1');
          expect(results[0].value).toEqual('grp1');
          expect(results[1].text).toEqual('grp2');
          expect(results[1].value).toEqual('grp2');
        });
      });
    });

    describe('When performing getResourceNames', () => {
      let subscription = 'mock-subscription-id';
      let resourceGroup = 'nodeapp';
      let metricNamespace = 'microsoft.insights/components';
      let region = '';

      beforeEach(() => {
        subscription = 'mock-subscription-id';
        resourceGroup = 'nodeapp';
        metricNamespace = 'microsoft.insights/components';
      });

      describe('and there are no special cases', () => {
        const response = {
          value: [
            {
              name: 'Failure Anomalies - nodeapp',
              type: 'microsoft.insights/alertrules',
            },
            {
              name: resourceGroup,
              type: metricNamespace,
            },
          ],
        };

        beforeEach(() => {
          ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation((path: string) => {
            const basePath = `azuremonitor/subscriptions/${subscription}/resourceGroups`;
            expect(path).toBe(
              `${basePath}/${resourceGroup}/resources?api-version=2021-04-01&$filter=resourceType eq '${metricNamespace}'${
                region ? ` and location eq '${region}'` : ''
              }`
            );
            return Promise.resolve(response);
          });
        });

        it('should return list of Resource Names', () => {
          return ctx.ds
            .getResourceNames(subscription, resourceGroup, metricNamespace)
            .then((results: Array<{ text: string; value: string }>) => {
              expect(results.length).toEqual(1);
              expect(results[0].text).toEqual('nodeapp');
              expect(results[0].value).toEqual('nodeapp');
            });
        });

        it('should return ignore letter case', () => {
          metricNamespace = 'microsoft.insights/Components';
          return ctx.ds
            .getResourceNames(subscription, resourceGroup, metricNamespace)
            .then((results: Array<{ text: string; value: string }>) => {
              expect(results.length).toEqual(1);
              expect(results[0].text).toEqual('nodeapp');
              expect(results[0].value).toEqual('nodeapp');
            });
        });

        it('should return include a region', () => {
          region = 'eastus';
          return ctx.ds
            .getResourceNames(subscription, resourceGroup, metricNamespace, region)
            .then((results: Array<{ text: string; value: string }>) => {
              expect(results.length).toEqual(1);
              expect(results[0].text).toEqual('nodeapp');
              expect(results[0].value).toEqual('nodeapp');
            });
        });

        it('should return multiple resources from a template variable', () => {
          replace = (
            target?: string,
            _scopedVars?: ScopedVars,
            _format?: string | Function,
            interpolated?: VariableInterpolation[]
          ) => {
            if (target?.includes('$reg')) {
              if (interpolated) {
                interpolated.push({ value: 'eastus', match: '$reg', variableName: 'reg' });
              }
              return 'eastus';
            }

            if (target === `$${multiVariable.id}`) {
              if (interpolated) {
                interpolated.push({ value: 'foo,bar', match: `$${multiVariable.id}`!, variableName: 'target' });
              }
              return 'foo,bar';
            }

            if (interpolated) {
              interpolated.push({ value: target ?? '', match: `$${target}`!, variableName: 'target' });
            }
            return target === `$${multiVariable.id}` ? 'foo,bar' : (target ?? '');
          };
          const ds = new AzureMonitorDatasource(ctx.instanceSettings);
          //ds.azureMonitorDatasource.templateSrv = tsrv;
          ds.azureMonitorDatasource.getResource = jest
            .fn()
            .mockImplementationOnce((path: string) => {
              expect(path).toMatch('foo');
              return Promise.resolve(response);
            })
            .mockImplementationOnce((path: string) => {
              expect(path).toMatch('bar');
              return Promise.resolve({
                value: [
                  {
                    name: resourceGroup + '2',
                    type: metricNamespace,
                  },
                ],
              });
            });
          return ds
            .getResourceNames(subscription, `$${multiVariable.id}`, metricNamespace)
            .then((results: Array<{ text: string; value: string }>) => {
              expect(results.length).toEqual(2);
              expect(results[0].text).toEqual('nodeapp');
              expect(results[0].value).toEqual('nodeapp');
              expect(results[1].text).toEqual('nodeapp2');
              expect(results[1].value).toEqual('nodeapp2');
            });
        });
      });

      describe('and the metric definition is blobServices', () => {
        const response = {
          value: [
            {
              name: 'Failure Anomalies - nodeapp',
              type: 'microsoft.insights/alertrules',
            },
            {
              name: 'storagetest',
              type: 'microsoft.storage/storageaccounts',
            },
          ],
        };

        it('should return list of Resource Names', () => {
          metricNamespace = 'microsoft.storage/storageaccounts/blobservices';
          const validMetricNamespace = 'microsoft.storage/storageaccounts';
          ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation((path: string) => {
            const basePath = `azuremonitor/subscriptions/${subscription}/resourceGroups`;
            expect(path).toBe(
              basePath +
                `/${resourceGroup}/resources?api-version=2021-04-01&$filter=resourceType eq '${validMetricNamespace}'`
            );
            return Promise.resolve(response);
          });
          return ctx.ds
            .getResourceNames(subscription, resourceGroup, metricNamespace)
            .then((results: Array<{ text: string; value: string }>) => {
              expect(results.length).toEqual(1);
              expect(results[0].text).toEqual('storagetest/default');
              expect(results[0].value).toEqual('storagetest/default');
              expect(ctx.ds.azureMonitorDatasource.getResource).toHaveBeenCalledWith(
                `azuremonitor/subscriptions/${subscription}/resourceGroups/${resourceGroup}/resources?api-version=2021-04-01&$filter=resourceType eq '${validMetricNamespace}'`
              );
            });
        });
      });

      describe('and there are several pages', () => {
        const skipToken = 'token';
        const response1 = {
          value: [
            {
              name: `${resourceGroup}1`,
              type: metricNamespace,
            },
          ],
          nextLink: `https://management.azure.com/resourceuri?$skiptoken=${skipToken}`,
        };
        const response2 = {
          value: [
            {
              name: `${resourceGroup}2`,
              type: metricNamespace,
            },
          ],
        };

        beforeEach(() => {
          const fn = jest.fn();
          ctx.ds.azureMonitorDatasource.getResource = fn;
          const basePath = `azuremonitor/subscriptions/${subscription}/resourceGroups`;
          const expectedPath = `${basePath}/${resourceGroup}/resources?api-version=2021-04-01&$filter=resourceType eq '${metricNamespace}'`;
          // first page
          fn.mockImplementationOnce((path: string) => {
            expect(path).toBe(expectedPath);
            return Promise.resolve(response1);
          });
          // second page
          fn.mockImplementationOnce((path: string) => {
            expect(path).toBe(`${expectedPath}&$skiptoken=${skipToken}`);
            return Promise.resolve(response2);
          });
        });

        it('should return list of Resource Names', () => {
          return ctx.ds
            .getResourceNames(subscription, resourceGroup, metricNamespace)
            .then((results: Array<{ text: string; value: string }>) => {
              expect(results.length).toEqual(2);
              expect(results[0].value).toEqual(`${resourceGroup}1`);
              expect(results[1].value).toEqual(`${resourceGroup}2`);
            });
        });
      });

      describe('without a resource group or a metric definition', () => {
        const response = {
          value: [
            {
              name: 'Failure Anomalies - nodeapp',
              type: 'microsoft.insights/alertrules',
            },
            {
              name: resourceGroup,
              type: metricNamespace,
            },
          ],
        };

        beforeEach(() => {
          ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation((path: string) => {
            const basePath = `azuremonitor/subscriptions/${subscription}/resources?api-version=2021-04-01`;
            expect(path).toBe(basePath);
            return Promise.resolve(response);
          });
        });

        it('should return list of Resource Names', () => {
          return ctx.ds.getResourceNames(subscription).then((results: Array<{ text: string; value: string }>) => {
            expect(results.length).toEqual(2);
          });
        });
      });
    });

    describe('When performing getMetricNames', () => {
      const response = {
        value: [
          {
            name: {
              value: 'UsedCapacity',
              localizedValue: 'Used capacity',
            },
            unit: 'CountPerSecond',
            primaryAggregationType: 'Total',
            supportedAggregationTypes: ['None', 'Average', 'Minimum', 'Maximum', 'Total', 'Count'],
            metricAvailabilities: [
              { timeGrain: 'PT1H', retention: 'P93D' },
              { timeGrain: 'PT6H', retention: 'P93D' },
              { timeGrain: 'PT12H', retention: 'P93D' },
              { timeGrain: 'P1D', retention: 'P93D' },
            ],
          },
          {
            name: {
              value: 'FreeCapacity',
              localizedValue: 'Free capacity',
            },
            unit: 'CountPerSecond',
            primaryAggregationType: 'Average',
            supportedAggregationTypes: ['None', 'Average'],
            metricAvailabilities: [
              { timeGrain: 'PT1H', retention: 'P93D' },
              { timeGrain: 'PT6H', retention: 'P93D' },
              { timeGrain: 'PT12H', retention: 'P93D' },
              { timeGrain: 'P1D', retention: 'P93D' },
            ],
          },
        ],
      };

      beforeEach(() => {
        ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation((path: string) => {
          const basePath = 'azuremonitor/subscriptions/mock-subscription-id/resourceGroups/nodeapp';
          const expected =
            basePath +
            '/providers/microsoft.insights/components/resource1' +
            '/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01';
          expect(path).toBe(expected);
          return Promise.resolve(response);
        });
      });

      it('should return list of Metric Definitions', () => {
        return ctx.ds.azureMonitorDatasource
          .getMetricNames({
            subscription: 'mock-subscription-id',
            resourceGroup: 'nodeapp',
            metricNamespace: 'microsoft.insights/components',
            resourceName: 'resource1',
          })
          .then((results: Array<{ text: string; value: string }>) => {
            expect(results.length).toEqual(2);
            expect(results[0].text).toEqual('Used capacity');
            expect(results[0].value).toEqual('UsedCapacity');
            expect(results[1].text).toEqual('Free capacity');
            expect(results[1].value).toEqual('FreeCapacity');
          });
      });
    });

    describe('When performing getMetricMetadata', () => {
      const response = {
        value: [
          {
            name: {
              value: 'UsedCapacity',
              localizedValue: 'Used capacity',
            },
            unit: 'CountPerSecond',
            primaryAggregationType: 'Total',
            supportedAggregationTypes: ['None', 'Average', 'Minimum', 'Maximum', 'Total', 'Count'],
            metricAvailabilities: [
              { timeGrain: 'PT1H', retention: 'P93D' },
              { timeGrain: 'PT6H', retention: 'P93D' },
              { timeGrain: 'PT12H', retention: 'P93D' },
              { timeGrain: 'P1D', retention: 'P93D' },
            ],
          },
          {
            name: {
              value: 'FreeCapacity',
              localizedValue: 'Free capacity',
            },
            unit: 'CountPerSecond',
            primaryAggregationType: 'Average',
            supportedAggregationTypes: ['None', 'Average'],
            metricAvailabilities: [
              { timeGrain: 'PT1H', retention: 'P93D' },
              { timeGrain: 'PT6H', retention: 'P93D' },
              { timeGrain: 'PT12H', retention: 'P93D' },
              { timeGrain: 'P1D', retention: 'P93D' },
            ],
          },
        ],
      };

      beforeEach(() => {
        ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation((path: string) => {
          const basePath = 'azuremonitor/subscriptions/mock-subscription-id/resourceGroups/nodeapp';
          const expected =
            basePath +
            '/providers/microsoft.insights/components/resource1' +
            '/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01';
          expect(path).toBe(expected);
          return Promise.resolve(response);
        });
      });

      it('should return Aggregation metadata for a Metric', () => {
        return ctx.ds.azureMonitorDatasource
          .getMetricMetadata({
            subscription: 'mock-subscription-id',
            resourceGroup: 'nodeapp',
            metricNamespace: 'microsoft.insights/components',
            resourceName: 'resource1',
            metricName: 'UsedCapacity',
          })
          .then((results) => {
            expect(results.primaryAggType).toEqual('Total');
            expect(results.supportedAggTypes.length).toEqual(6);
            expect(results.supportedTimeGrains.length).toEqual(5); // 4 time grains from the API + auto
          });
      });
    });

    describe('When performing getMetricMetadata on metrics with dimensions', () => {
      const response = {
        value: [
          {
            name: {
              value: 'Transactions',
              localizedValue: 'Transactions',
            },
            unit: 'Count',
            primaryAggregationType: 'Total',
            supportedAggregationTypes: ['None', 'Average', 'Minimum', 'Maximum', 'Total', 'Count'],
            isDimensionRequired: false,
            dimensions: [
              {
                value: 'ResponseType',
                localizedValue: 'Response type',
              },
              {
                value: 'GeoType',
                localizedValue: 'Geo type',
              },
              {
                value: 'ApiName',
                localizedValue: 'API name',
              },
            ],
          },
          {
            name: {
              value: 'FreeCapacity',
              localizedValue: 'Free capacity',
            },
            unit: 'CountPerSecond',
            primaryAggregationType: 'Average',
            supportedAggregationTypes: ['None', 'Average'],
          },
        ],
      };

      beforeEach(() => {
        ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation((path: string) => {
          const basePath = 'azuremonitor/subscriptions/mock-subscription-id/resourceGroups/nodeapp';
          const expected =
            basePath +
            '/providers/microsoft.insights/components/resource1' +
            '/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01';
          expect(path).toBe(expected);
          return Promise.resolve(response);
        });
      });

      it('should return dimensions for a Metric that has dimensions', () => {
        return ctx.ds.azureMonitorDatasource
          .getMetricMetadata({
            subscription: 'mock-subscription-id',
            resourceGroup: 'nodeapp',
            metricNamespace: 'microsoft.insights/components',
            resourceName: 'resource1',
            metricName: 'Transactions',
          })
          .then((results) => {
            expect(results.dimensions).toMatchInlineSnapshot(`
              [
                {
                  "label": "Response type",
                  "value": "ResponseType",
                },
                {
                  "label": "Geo type",
                  "value": "GeoType",
                },
                {
                  "label": "API name",
                  "value": "ApiName",
                },
              ]
            `);
          });
      });

      it('should return an empty array for a Metric that does not have dimensions', () => {
        return ctx.ds.azureMonitorDatasource
          .getMetricMetadata({
            subscription: 'mock-subscription-id',
            resourceGroup: 'nodeapp',
            metricNamespace: 'microsoft.insights/components',
            resourceName: 'resource1',
            metricName: 'FreeCapacity',
          })
          .then((results) => {
            expect(results.dimensions.length).toEqual(0);
          });
      });
    });
  });
});
