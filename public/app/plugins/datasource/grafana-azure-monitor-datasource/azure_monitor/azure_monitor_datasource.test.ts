import { startsWith, get, set } from 'lodash';

import { DataSourceInstanceSettings } from '@grafana/data';
import { TemplateSrv } from 'app/features/templating/template_srv';

import createMockQuery from '../__mocks__/query';
import { createTemplateVariables } from '../__mocks__/utils';
import { singleVariable, subscriptionsVariable } from '../__mocks__/variables';
import AzureMonitorDatasource from '../datasource';
import { AzureDataSourceJsonData, AzureQueryType } from '../types';

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
          '/providers/microsoft.insights/metricNamespaces?api-version=2017-12-01-preview';
        expect(path).toBe(expected);
        return Promise.resolve(response);
      });
    });

    it('should return list of Metric Namspaces', () => {
      return ctx.ds.azureMonitorDatasource
        .getMetricNamespaces({
          resourceUri:
            '/subscriptions/mock-subscription-id/resourceGroups/nodeapp/providers/microsoft.insights/components/resource1',
        })
        .then((results: Array<{ text: string; value: string }>) => {
          expect(results.length).toEqual(2);
          expect(results[0].text).toEqual('Azure.ApplicationInsights');
          expect(results[0].value).toEqual('Azure.ApplicationInsights');
          expect(results[1].text).toEqual('microsoft.insights-components');
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
          '/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01&metricnamespace=default';
        expect(path).toBe(expected);
        return Promise.resolve(response);
      });
    });

    it('should return list of Metric Definitions', () => {
      return ctx.ds.azureMonitorDatasource
        .getMetricNames({
          resourceUri:
            '/subscriptions/mock-subscription-id/resourceGroups/nodeapp/providers/microsoft.insights/components/resource1',
          metricNamespace: 'default',
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
          '/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01&metricnamespace=default';
        expect(path).toBe(expected);
        return Promise.resolve(response);
      });
    });

    it('should return Aggregation metadata for a Metric', () => {
      return ctx.ds.azureMonitorDatasource
        .getMetricMetadata({
          resourceUri:
            '/subscriptions/mock-subscription-id/resourceGroups/nodeapp/providers/microsoft.insights/components/resource1',
          metricNamespace: 'default',
          metricName: 'UsedCapacity',
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
        'resourceUri',
        'resourceGroup',
        'resourceName',
        'metricNamespace',
        'metricDefinition',
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

    describe('When performing getMetricDefinitions', () => {
      const response = {
        value: [
          {
            name: 'test',
            type: 'Microsoft.Network/networkInterfaces',
          },
          {
            location: 'northeurope',
            name: 'northeur',
            type: 'Microsoft.Compute/virtualMachines',
          },
          {
            location: 'westcentralus',
            name: 'us',
            type: 'Microsoft.Compute/virtualMachines',
          },
          {
            name: 'IHaveNoMetrics',
            type: 'IShouldBeFilteredOut',
          },
          {
            name: 'storageTest',
            type: 'Microsoft.Storage/storageAccounts',
          },
        ],
      };

      beforeEach(() => {
        ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation((path: string) => {
          const basePath = 'azuremonitor/subscriptions/mock-subscription-id/resourceGroups';
          expect(path).toBe(basePath + '/nodesapp/resources?api-version=2021-04-01');
          return Promise.resolve(response);
        });
      });

      it('should return list of Metric Definitions with no duplicates and no unsupported namespaces', () => {
        return ctx.ds
          .getMetricDefinitions('mock-subscription-id', 'nodesapp')
          .then((results: Array<{ text: string; value: string }>) => {
            expect(results.length).toEqual(7);
            expect(results[0].text).toEqual('Network interfaces');
            expect(results[0].value).toEqual('Microsoft.Network/networkInterfaces');
            expect(results[1].text).toEqual('Virtual machines');
            expect(results[1].value).toEqual('Microsoft.Compute/virtualMachines');
            expect(results[2].text).toEqual('Storage accounts');
            expect(results[2].value).toEqual('Microsoft.Storage/storageAccounts');
            expect(results[3].text).toEqual('Microsoft.Storage/storageAccounts/blobServices');
            expect(results[3].value).toEqual('Microsoft.Storage/storageAccounts/blobServices');
            expect(results[4].text).toEqual('Microsoft.Storage/storageAccounts/fileServices');
            expect(results[4].value).toEqual('Microsoft.Storage/storageAccounts/fileServices');
            expect(results[5].text).toEqual('Microsoft.Storage/storageAccounts/tableServices');
            expect(results[5].value).toEqual('Microsoft.Storage/storageAccounts/tableServices');
            expect(results[6].text).toEqual('Microsoft.Storage/storageAccounts/queueServices');
            expect(results[6].value).toEqual('Microsoft.Storage/storageAccounts/queueServices');
          });
      });
    });

    describe('When performing getResourceNames', () => {
      let subscription = 'mock-subscription-id';
      let resourceGroup = 'nodeapp';
      let metricDefinition = 'microsoft.insights/components';

      beforeEach(() => {
        subscription = 'mock-subscription-id';
        resourceGroup = 'nodeapp';
        metricDefinition = 'microsoft.insights/components';
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
              type: metricDefinition,
            },
          ],
        };

        beforeEach(() => {
          ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation((path: string) => {
            const basePath = `azuremonitor/subscriptions/${subscription}/resourceGroups`;
            expect(path).toBe(
              `${basePath}/${resourceGroup}/resources?$filter=resourceType eq '${metricDefinition}'&api-version=2021-04-01`
            );
            return Promise.resolve(response);
          });
        });

        it('should return list of Resource Names', () => {
          return ctx.ds
            .getResourceNames(subscription, resourceGroup, metricDefinition)
            .then((results: Array<{ text: string; value: string }>) => {
              expect(results.length).toEqual(1);
              expect(results[0].text).toEqual('nodeapp');
              expect(results[0].value).toEqual('nodeapp');
            });
        });

        it('should return ignore letter case', () => {
          metricDefinition = 'microsoft.insights/Components';
          return ctx.ds
            .getResourceNames(subscription, resourceGroup, metricDefinition)
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
              type: 'Microsoft.Storage/storageAccounts',
            },
          ],
        };

        it('should return list of Resource Names', () => {
          metricDefinition = 'Microsoft.Storage/storageAccounts/blobServices';
          const validMetricDefinition = startsWith(metricDefinition, 'Microsoft.Storage/storageAccounts/')
            ? 'Microsoft.Storage/storageAccounts'
            : metricDefinition;
          ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation((path: string) => {
            const basePath = `azuremonitor/subscriptions/${subscription}/resourceGroups`;
            expect(path).toBe(
              basePath +
                `/${resourceGroup}/resources?$filter=resourceType eq '${validMetricDefinition}'&api-version=2021-04-01`
            );
            return Promise.resolve(response);
          });
          return ctx.ds
            .getResourceNames(subscription, resourceGroup, metricDefinition)
            .then((results: Array<{ text: string; value: string }>) => {
              expect(results.length).toEqual(1);
              expect(results[0].text).toEqual('storagetest/default');
              expect(results[0].value).toEqual('storagetest/default');
              expect(ctx.ds.azureMonitorDatasource.getResource).toHaveBeenCalledWith(
                `azuremonitor/subscriptions/${subscription}/resourceGroups/${resourceGroup}/resources?$filter=resourceType eq '${validMetricDefinition}'&api-version=2021-04-01`
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
              type: metricDefinition,
            },
          ],
          nextLink: `https://management.azure.com/resourceuri?$skiptoken=${skipToken}`,
        };
        const response2 = {
          value: [
            {
              name: `${resourceGroup}2`,
              type: metricDefinition,
            },
          ],
        };

        beforeEach(() => {
          const fn = jest.fn();
          ctx.ds.azureMonitorDatasource.getResource = fn;
          const basePath = `azuremonitor/subscriptions/${subscription}/resourceGroups`;
          const expectedPath = `${basePath}/${resourceGroup}/resources?$filter=resourceType eq '${metricDefinition}'&api-version=2021-04-01`;
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
            .getResourceNames(subscription, resourceGroup, metricDefinition)
            .then((results: Array<{ text: string; value: string }>) => {
              expect(results.length).toEqual(2);
              expect(results[0].value).toEqual(`${resourceGroup}1`);
              expect(results[1].value).toEqual(`${resourceGroup}2`);
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
            '/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01&metricnamespace=default';
          expect(path).toBe(expected);
          return Promise.resolve(response);
        });
      });

      it('should return list of Metric Definitions', () => {
        return ctx.ds.azureMonitorDatasource
          .getMetricNames({
            subscription: 'mock-subscription-id',
            resourceGroup: 'nodeapp',
            metricDefinition: 'microsoft.insights/components',
            resourceName: 'resource1',
            metricNamespace: 'default',
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
            '/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01&metricnamespace=default';
          expect(path).toBe(expected);
          return Promise.resolve(response);
        });
      });

      it('should return Aggregation metadata for a Metric', () => {
        return ctx.ds.azureMonitorDatasource
          .getMetricMetadata({
            subscription: 'mock-subscription-id',
            resourceGroup: 'nodeapp',
            metricDefinition: 'microsoft.insights/components',
            resourceName: 'resource1',
            metricNamespace: 'default',
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
            '/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01&metricnamespace=default';
          expect(path).toBe(expected);
          return Promise.resolve(response);
        });
      });

      it('should return dimensions for a Metric that has dimensions', () => {
        return ctx.ds.azureMonitorDatasource
          .getMetricMetadata({
            subscription: 'mock-subscription-id',
            resourceGroup: 'nodeapp',
            metricDefinition: 'microsoft.insights/components',
            resourceName: 'resource1',
            metricNamespace: 'default',
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
            metricDefinition: 'microsoft.insights/components',
            resourceName: 'resource1',
            metricNamespace: 'default',
            metricName: 'FreeCapacity',
          })
          .then((results: any) => {
            expect(results.dimensions.length).toEqual(0);
          });
      });
    });
  });
});
