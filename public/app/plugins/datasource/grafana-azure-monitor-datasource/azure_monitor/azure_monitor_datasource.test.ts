import { get, set } from 'lodash';

import { DataSourceInstanceSettings } from '@grafana/data';
import { TemplateSrv } from 'app/features/templating/template_srv';

import createMockQuery from '../__mocks__/query';
import { createTemplateVariables } from '../__mocks__/utils';
import { singleVariable, subscriptionsVariable } from '../__mocks__/variables';
import AzureMonitorDatasource from '../datasource';
import { AzureDataSourceJsonData, AzureMonitorLocationsResponse, AzureQueryType } from '../types';

const templateSrv = new TemplateSrv();

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
  getTemplateSrv: () => templateSrv,
}));

interface TestContext {
  instanceSettings: DataSourceInstanceSettings<AzureDataSourceJsonData>;
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
    } as unknown as DataSourceInstanceSettings<AzureDataSourceJsonData>;
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
        query: createMockQuery({ azureMonitor: { resourceGroup: undefined } }),
        filtered: false,
      },
      {
        description: 'filter query with no resourceName',
        query: createMockQuery({ azureMonitor: { resourceName: undefined } }),
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
      templateSrv.init([
        {
          id: 'resourceUri',
          name: 'resourceUri',
          current: {
            value: `/subscriptions/${subscription}/resourceGroups/${resourceGroup}/providers/${metricNamespace}/${resourceName}`,
          },
        },
      ]);
      const query = createMockQuery({
        azureMonitor: {
          resourceUri: '$resourceUri',
        },
      });
      const templatedQuery = ctx.ds.azureMonitorDatasource.applyTemplateVariables(query, {});
      expect(templatedQuery).toMatchObject({
        subscription,
        azureMonitor: {
          resourceGroup,
          metricNamespace,
          resourceName,
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
        const basePath = 'azuremonitor/subscriptions/mock-subscription-id/resourceGroups/nodeapp';
        const expected =
          basePath +
          '/providers/microsoft.insights/components/resource1' +
          '/providers/microsoft.insights/metricNamespaces?api-version=2017-12-01-preview&region=global';
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

    it('should return list of Metric Names', () => {
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
      templateSrv.init([
        {
          id: 'metric',
          name: 'metric',
          current: {
            value: 'UsedCapacity',
          },
        },
      ]);
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
      templateSrv.init([]);
    });

    it('should return a query unchanged if no template variables are provided', () => {
      const query = createMockQuery();
      const templatedQuery = ctx.ds.interpolateVariablesInQueries([query], {});
      expect(templatedQuery[0]).toEqual(query);
    });

    it('should return a query with any template variables replaced', () => {
      const templateableProps = [
        'resourceGroup',
        'resourceName',
        'metricNamespace',
        'timeGrain',
        'aggregation',
        'top',
        'dimensionFilters[0].dimension',
        'dimensionFilters[0].filters[0]',
      ];
      const templateVariables = createTemplateVariables(templateableProps);
      templateSrv.init(Array.from(templateVariables.values()).map((item) => item.templateVariable));
      const query = createMockQuery();
      const azureMonitorQuery: { [index: string]: any } = {};
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
    const sub1Response: AzureMonitorLocationsResponse = {
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

    const sub2Response: AzureMonitorLocationsResponse = {
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
              `${basePath}/${resourceGroup}/resources?api-version=2021-04-01&$filter=resourceType eq '${metricNamespace}'`
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
          .then((results: any) => {
            expect(results.dimensions).toMatchInlineSnapshot(`
              Array [
                Object {
                  "label": "Response type",
                  "value": "ResponseType",
                },
                Object {
                  "label": "Geo type",
                  "value": "GeoType",
                },
                Object {
                  "label": "API name",
                  "value": "ApiName",
                },
              ]
            `);
          });
      });

      describe('When performing targetContainsTemplate', () => {
        it('should return false when no variable is being used', () => {
          const query = createMockQuery();
          query.queryType = AzureQueryType.AzureMonitor;
          expect(ctx.ds.targetContainsTemplate(query)).toEqual(false);
        });

        it('should return true when subscriptions field is using a variable', () => {
          const query = createMockQuery();
          const templateSrv = new TemplateSrv();
          templateSrv.init([subscriptionsVariable]);

          const ds = new AzureMonitorDatasource(ctx.instanceSettings, templateSrv);
          query.queryType = AzureQueryType.AzureMonitor;
          query.subscription = `$${subscriptionsVariable.name}`;
          expect(ds.targetContainsTemplate(query)).toEqual(true);
        });

        it('should return false when a variable is used in a different part of the query', () => {
          const query = createMockQuery();
          const templateSrv = new TemplateSrv();
          templateSrv.init([singleVariable]);

          const ds = new AzureMonitorDatasource(ctx.instanceSettings, templateSrv);
          query.queryType = AzureQueryType.AzureMonitor;
          query.azureLogAnalytics = { resource: `$${singleVariable.name}` };
          expect(ds.targetContainsTemplate(query)).toEqual(false);
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
          .then((results: any) => {
            expect(results.dimensions.length).toEqual(0);
          });
      });
    });
  });
});
