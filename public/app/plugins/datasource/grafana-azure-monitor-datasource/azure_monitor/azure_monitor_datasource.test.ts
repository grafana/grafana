import AzureMonitorDatasource from '../datasource';

import { TemplateSrv } from 'app/features/templating/template_srv';
import { toUtc, DataFrame } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

describe('AzureMonitorDatasource', () => {
  const ctx: any = {
    templateSrv: new TemplateSrv(),
  };
  const datasourceRequestMock = jest.spyOn(backendSrv, 'datasourceRequest');

  beforeEach(() => {
    jest.clearAllMocks();
    ctx.instanceSettings = {
      url: 'http://azuremonitor.com',
      jsonData: { subscriptionId: '9935389e-9122-4ef9-95f9-1513dd24753f' },
      cloudName: 'azuremonitor',
    };

    ctx.ds = new AzureMonitorDatasource(ctx.instanceSettings, ctx.templateSrv);
  });

  describe('When performing testDatasource', () => {
    describe('and an error is returned', () => {
      const error = {
        data: {
          error: {
            code: 'InvalidApiVersionParameter',
            message: `An error message.`,
          },
        },
        status: 400,
        statusText: 'Bad Request',
      };

      beforeEach(() => {
        ctx.instanceSettings.jsonData.tenantId = 'xxx';
        ctx.instanceSettings.jsonData.clientId = 'xxx';
        datasourceRequestMock.mockImplementation(() => Promise.reject(error));
      });

      it('should return error status and a detailed error message', () => {
        return ctx.ds.testDatasource().then((results: any) => {
          expect(results.status).toEqual('error');
          expect(results.message).toEqual(
            '1. Azure Monitor: Bad Request: InvalidApiVersionParameter. An error message. '
          );
        });
      });
    });

    describe('and a list of resource groups is returned', () => {
      const response = {
        data: {
          value: [{ name: 'grp1' }, { name: 'grp2' }],
        },
        status: 200,
        statusText: 'OK',
      };

      beforeEach(() => {
        ctx.instanceSettings.jsonData.tenantId = 'xxx';
        ctx.instanceSettings.jsonData.clientId = 'xxx';
        datasourceRequestMock.mockImplementation(() => Promise.resolve({ data: response, status: 200 }));
      });

      it('should return success status', () => {
        return ctx.ds.testDatasource().then((results: any) => {
          expect(results.status).toEqual('success');
        });
      });
    });
  });

  describe('When performing query', () => {
    const options = {
      range: {
        from: toUtc('2017-08-22T20:00:00Z'),
        to: toUtc('2017-08-22T23:59:00Z'),
      },
      targets: [
        {
          apiVersion: '2018-01-01',
          refId: 'A',
          queryType: 'Azure Monitor',
          azureMonitor: {
            resourceGroup: 'testRG',
            resourceName: 'testRN',
            metricDefinition: 'Microsoft.Compute/virtualMachines',
            metricNamespace: 'default',
            metricName: 'Percentage CPU',
            timeGrain: 'PT1H',
            alias: '{{metric}}',
          },
        },
      ],
    };

    const response: any = {
      results: {
        A: {
          refId: 'A',
          meta: {
            rawQuery:
              'aggregation=Average&api-version=2018-01-01&interval=PT1M' +
              '&metricnames=Percentage+CPU&timespan=2019-05-19T15%3A11%3A37Z%2F2019-05-19T21%3A11%3A37Z',
            unit: 'Percent',
          },
          series: [
            {
              name: 'Percentage CPU',
              points: [
                [2.2075, 1558278660000],
                [2.29, 1558278720000],
              ],
            },
          ],
          tables: null,
        },
      },
    };

    beforeEach(() => {
      datasourceRequestMock.mockImplementation((options: { url: string }) => {
        expect(options.url).toContain('/api/tsdb/query');
        return Promise.resolve({ data: response, status: 200 });
      });
    });

    it('should return a list of datapoints', () => {
      return ctx.ds.query(options).then((results: any) => {
        expect(results.data.length).toBe(1);
        const data = results.data[0] as DataFrame;
        expect(data.name).toEqual('Percentage CPU');
        expect(data.fields[1].values.get(0)).toEqual(1558278660000);
        expect(data.fields[0].values.get(0)).toEqual(2.2075);
        expect(data.fields[1].values.get(1)).toEqual(1558278720000);
        expect(data.fields[0].values.get(1)).toEqual(2.29);
      });
    });
  });

  describe('When performing metricFindQuery', () => {
    describe('with a subscriptions query', () => {
      const response = {
        data: {
          value: [
            { displayName: 'Primary', subscriptionId: 'sub1' },
            { displayName: 'Secondary', subscriptionId: 'sub2' },
          ],
        },
        status: 200,
        statusText: 'OK',
      };

      beforeEach(() => {
        datasourceRequestMock.mockImplementation(() => Promise.resolve(response));
      });

      it('should return a list of subscriptions', () => {
        return ctx.ds.metricFindQuery('subscriptions()').then((results: Array<{ text: string; value: string }>) => {
          expect(results.length).toBe(2);
          expect(results[0].text).toBe('Primary - sub1');
          expect(results[0].value).toBe('sub1');
          expect(results[1].text).toBe('Secondary - sub2');
          expect(results[1].value).toBe('sub2');
        });
      });
    });

    describe('with a resource groups query', () => {
      const response = {
        data: {
          value: [{ name: 'grp1' }, { name: 'grp2' }],
        },
        status: 200,
        statusText: 'OK',
      };

      beforeEach(() => {
        datasourceRequestMock.mockImplementation(() => Promise.resolve(response));
      });

      it('should return a list of resource groups', () => {
        return ctx.ds.metricFindQuery('ResourceGroups()').then((results: Array<{ text: string; value: string }>) => {
          expect(results.length).toBe(2);
          expect(results[0].text).toBe('grp1');
          expect(results[0].value).toBe('grp1');
          expect(results[1].text).toBe('grp2');
          expect(results[1].value).toBe('grp2');
        });
      });
    });

    describe('with a resource groups query that specifies a subscription id', () => {
      const response = {
        data: {
          value: [{ name: 'grp1' }, { name: 'grp2' }],
        },
        status: 200,
        statusText: 'OK',
      };

      beforeEach(() => {
        datasourceRequestMock.mockImplementation((options: { url: string }) => {
          expect(options.url).toContain('11112222-eeee-4949-9b2d-9106972f9123');
          return Promise.resolve(response);
        });
      });

      it('should return a list of resource groups', () => {
        return ctx.ds
          .metricFindQuery('ResourceGroups(11112222-eeee-4949-9b2d-9106972f9123)')
          .then((results: Array<{ text: string; value: string }>) => {
            expect(results.length).toBe(2);
            expect(results[0].text).toBe('grp1');
            expect(results[0].value).toBe('grp1');
            expect(results[1].text).toBe('grp2');
            expect(results[1].value).toBe('grp2');
          });
      });
    });

    describe('with namespaces query', () => {
      const response = {
        data: {
          value: [
            {
              name: 'test',
              type: 'Microsoft.Network/networkInterfaces',
            },
          ],
        },
        status: 200,
        statusText: 'OK',
      };

      beforeEach(() => {
        datasourceRequestMock.mockImplementation((options: { url: string }) => {
          const baseUrl =
            'http://azuremonitor.com/azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups';
          expect(options.url).toBe(baseUrl + '/nodesapp/resources?api-version=2018-01-01');
          return Promise.resolve(response);
        });
      });

      it('should return a list of namespaces', () => {
        return ctx.ds
          .metricFindQuery('Namespaces(nodesapp)')
          .then((results: Array<{ text: string; value: string }>) => {
            expect(results.length).toEqual(1);
            expect(results[0].text).toEqual('Microsoft.Network/networkInterfaces');
            expect(results[0].value).toEqual('Microsoft.Network/networkInterfaces');
          });
      });
    });

    describe('with namespaces query that specifies a subscription id', () => {
      const response = {
        data: {
          value: [
            {
              name: 'test',
              type: 'Microsoft.Network/networkInterfaces',
            },
          ],
        },
        status: 200,
        statusText: 'OK',
      };

      beforeEach(() => {
        datasourceRequestMock.mockImplementation((options: { url: string }) => {
          const baseUrl =
            'http://azuremonitor.com/azuremonitor/subscriptions/11112222-eeee-4949-9b2d-9106972f9123/resourceGroups';
          expect(options.url).toBe(baseUrl + '/nodesapp/resources?api-version=2018-01-01');
          return Promise.resolve(response);
        });
      });

      it('should return a list of namespaces', () => {
        return ctx.ds
          .metricFindQuery('namespaces(11112222-eeee-4949-9b2d-9106972f9123, nodesapp)')
          .then((results: Array<{ text: string; value: string }>) => {
            expect(results.length).toEqual(1);
            expect(results[0].text).toEqual('Microsoft.Network/networkInterfaces');
            expect(results[0].value).toEqual('Microsoft.Network/networkInterfaces');
          });
      });
    });

    describe('with resource names query', () => {
      const response = {
        data: {
          value: [
            {
              name: 'Failure Anomalies - nodeapp',
              type: 'microsoft.insights/alertrules',
            },
            {
              name: 'nodeapp',
              type: 'microsoft.insights/components',
            },
          ],
        },
        status: 200,
        statusText: 'OK',
      };

      beforeEach(() => {
        datasourceRequestMock.mockImplementation((options: { url: string }) => {
          const baseUrl =
            'http://azuremonitor.com/azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups';
          expect(options.url).toBe(baseUrl + '/nodeapp/resources?api-version=2018-01-01');
          return Promise.resolve(response);
        });
      });

      it('should return a list of resource names', () => {
        return ctx.ds
          .metricFindQuery('resourceNames(nodeapp, microsoft.insights/components )')
          .then((results: Array<{ text: string; value: string }>) => {
            expect(results.length).toEqual(1);
            expect(results[0].text).toEqual('nodeapp');
            expect(results[0].value).toEqual('nodeapp');
          });
      });
    });

    describe('with resource names query and that specifies a subscription id', () => {
      const response = {
        data: {
          value: [
            {
              name: 'Failure Anomalies - nodeapp',
              type: 'microsoft.insights/alertrules',
            },
            {
              name: 'nodeapp',
              type: 'microsoft.insights/components',
            },
          ],
        },
        status: 200,
        statusText: 'OK',
      };

      beforeEach(() => {
        datasourceRequestMock.mockImplementation((options: { url: string }) => {
          const baseUrl =
            'http://azuremonitor.com/azuremonitor/subscriptions/11112222-eeee-4949-9b2d-9106972f9123/resourceGroups';
          expect(options.url).toBe(baseUrl + '/nodeapp/resources?api-version=2018-01-01');
          return Promise.resolve(response);
        });
      });

      it('should return a list of resource names', () => {
        return ctx.ds
          .metricFindQuery(
            'resourceNames(11112222-eeee-4949-9b2d-9106972f9123, nodeapp, microsoft.insights/components )'
          )
          .then((results: any) => {
            expect(results.length).toEqual(1);
            expect(results[0].text).toEqual('nodeapp');
            expect(results[0].value).toEqual('nodeapp');
          });
      });
    });

    describe('with metric names query', () => {
      const response = {
        data: {
          value: [
            {
              name: {
                value: 'Percentage CPU',
                localizedValue: 'Percentage CPU',
              },
            },
            {
              name: {
                value: 'UsedCapacity',
                localizedValue: 'Used capacity',
              },
            },
          ],
        },
        status: 200,
        statusText: 'OK',
      };

      beforeEach(() => {
        datasourceRequestMock.mockImplementation((options: { url: string }) => {
          const baseUrl =
            'http://azuremonitor.com/azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups';
          expect(options.url).toBe(
            baseUrl +
              '/nodeapp/providers/microsoft.insights/components/rn/providers/microsoft.insights/' +
              'metricdefinitions?api-version=2018-01-01&metricnamespace=default'
          );
          return Promise.resolve(response);
        });
      });

      it('should return a list of metric names', () => {
        return ctx.ds
          .metricFindQuery('Metricnames(nodeapp, microsoft.insights/components, rn, default)')
          .then((results: Array<{ text: string; value: string }>) => {
            expect(results.length).toEqual(2);
            expect(results[0].text).toEqual('Percentage CPU');
            expect(results[0].value).toEqual('Percentage CPU');

            expect(results[1].text).toEqual('Used capacity');
            expect(results[1].value).toEqual('UsedCapacity');
          });
      });
    });

    describe('with metric names query and specifies a subscription id', () => {
      const response = {
        data: {
          value: [
            {
              name: {
                value: 'Percentage CPU',
                localizedValue: 'Percentage CPU',
              },
            },
            {
              name: {
                value: 'UsedCapacity',
                localizedValue: 'Used capacity',
              },
            },
          ],
        },
        status: 200,
        statusText: 'OK',
      };

      beforeEach(() => {
        datasourceRequestMock.mockImplementation((options: { url: string }) => {
          const baseUrl =
            'http://azuremonitor.com/azuremonitor/subscriptions/11112222-eeee-4949-9b2d-9106972f9123/resourceGroups';
          expect(options.url).toBe(
            baseUrl +
              '/nodeapp/providers/microsoft.insights/components/rn/providers/microsoft.insights/' +
              'metricdefinitions?api-version=2018-01-01&metricnamespace=default'
          );
          return Promise.resolve(response);
        });
      });

      it('should return a list of metric names', () => {
        return ctx.ds
          .metricFindQuery(
            'Metricnames(11112222-eeee-4949-9b2d-9106972f9123, nodeapp, microsoft.insights/components, rn, default)'
          )
          .then((results: Array<{ text: string; value: string }>) => {
            expect(results.length).toEqual(2);
            expect(results[0].text).toEqual('Percentage CPU');
            expect(results[0].value).toEqual('Percentage CPU');

            expect(results[1].text).toEqual('Used capacity');
            expect(results[1].value).toEqual('UsedCapacity');
          });
      });
    });

    describe('with metric namespace query', () => {
      const response = {
        data: {
          value: [
            {
              name: 'Microsoft.Compute-virtualMachines',
              properties: {
                metricNamespaceName: 'Microsoft.Compute/virtualMachines',
              },
            },
            {
              name: 'Telegraf-mem',
              properties: {
                metricNamespaceName: 'Telegraf/mem',
              },
            },
          ],
        },
        status: 200,
        statusText: 'OK',
      };

      beforeEach(() => {
        datasourceRequestMock.mockImplementation((options: { url: string }) => {
          const baseUrl =
            'http://azuremonitor.com/azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups';
          expect(options.url).toBe(
            baseUrl +
              '/nodeapp/providers/Microsoft.Compute/virtualMachines/rn/providers/microsoft.insights/metricNamespaces?api-version=2017-12-01-preview'
          );
          return Promise.resolve(response);
        });
      });

      it('should return a list of metric names', () => {
        return ctx.ds
          .metricFindQuery('Metricnamespace(nodeapp, Microsoft.Compute/virtualMachines, rn)')
          .then((results: Array<{ text: string; value: string }>) => {
            expect(results.length).toEqual(2);
            expect(results[0].text).toEqual('Microsoft.Compute-virtualMachines');
            expect(results[0].value).toEqual('Microsoft.Compute/virtualMachines');

            expect(results[1].text).toEqual('Telegraf-mem');
            expect(results[1].value).toEqual('Telegraf/mem');
          });
      });
    });

    describe('with metric namespace query and specifies a subscription id', () => {
      const response = {
        data: {
          value: [
            {
              name: 'Microsoft.Compute-virtualMachines',
              properties: {
                metricNamespaceName: 'Microsoft.Compute/virtualMachines',
              },
            },
            {
              name: 'Telegraf-mem',
              properties: {
                metricNamespaceName: 'Telegraf/mem',
              },
            },
          ],
        },
        status: 200,
        statusText: 'OK',
      };

      beforeEach(() => {
        datasourceRequestMock.mockImplementation((options: { url: string }) => {
          const baseUrl =
            'http://azuremonitor.com/azuremonitor/subscriptions/11112222-eeee-4949-9b2d-9106972f9123/resourceGroups';
          expect(options.url).toBe(
            baseUrl +
              '/nodeapp/providers/Microsoft.Compute/virtualMachines/rn/providers/microsoft.insights/metricNamespaces?api-version=2017-12-01-preview'
          );
          return Promise.resolve(response);
        });
      });

      it('should return a list of metric namespaces', () => {
        return ctx.ds
          .metricFindQuery(
            'Metricnamespace(11112222-eeee-4949-9b2d-9106972f9123, nodeapp, Microsoft.Compute/virtualMachines, rn)'
          )
          .then((results: Array<{ text: string; value: string }>) => {
            expect(results.length).toEqual(2);
            expect(results[0].text).toEqual('Microsoft.Compute-virtualMachines');
            expect(results[0].value).toEqual('Microsoft.Compute/virtualMachines');

            expect(results[1].text).toEqual('Telegraf-mem');
            expect(results[1].value).toEqual('Telegraf/mem');
          });
      });
    });
  });

  describe('When performing getSubscriptions', () => {
    const response = {
      data: {
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
      },
      status: 200,
      statusText: 'OK',
    };

    beforeEach(() => {
      datasourceRequestMock.mockImplementation(() => Promise.resolve(response));
    });

    it('should return list of Resource Groups', () => {
      return ctx.ds.getSubscriptions().then((results: Array<{ text: string; value: string }>) => {
        expect(results.length).toEqual(1);
        expect(results[0].text).toEqual('Primary Subscription - 99999999-cccc-bbbb-aaaa-9106972f9572');
        expect(results[0].value).toEqual('99999999-cccc-bbbb-aaaa-9106972f9572');
      });
    });
  });

  describe('When performing getResourceGroups', () => {
    const response = {
      data: {
        value: [{ name: 'grp1' }, { name: 'grp2' }],
      },
      status: 200,
      statusText: 'OK',
    };

    beforeEach(() => {
      datasourceRequestMock.mockImplementation(() => Promise.resolve(response));
    });

    it('should return list of Resource Groups', () => {
      return ctx.ds.getResourceGroups().then((results: Array<{ text: string; value: string }>) => {
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
      data: {
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
      },
      status: 200,
      statusText: 'OK',
    };

    beforeEach(() => {
      datasourceRequestMock.mockImplementation((options: { url: string }) => {
        const baseUrl =
          'http://azuremonitor.com/azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups';
        expect(options.url).toBe(baseUrl + '/nodesapp/resources?api-version=2018-01-01');
        return Promise.resolve(response);
      });
    });

    it('should return list of Metric Definitions with no duplicates and no unsupported namespaces', () => {
      return ctx.ds
        .getMetricDefinitions('9935389e-9122-4ef9-95f9-1513dd24753f', 'nodesapp')
        .then((results: Array<{ text: string; value: string }>) => {
          expect(results.length).toEqual(7);
          expect(results[0].text).toEqual('Microsoft.Network/networkInterfaces');
          expect(results[0].value).toEqual('Microsoft.Network/networkInterfaces');
          expect(results[1].text).toEqual('Microsoft.Compute/virtualMachines');
          expect(results[1].value).toEqual('Microsoft.Compute/virtualMachines');
          expect(results[2].text).toEqual('Microsoft.Storage/storageAccounts');
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
    describe('and there are no special cases', () => {
      const response = {
        data: {
          value: [
            {
              name: 'Failure Anomalies - nodeapp',
              type: 'microsoft.insights/alertrules',
            },
            {
              name: 'nodeapp',
              type: 'microsoft.insights/components',
            },
          ],
        },
        status: 200,
        statusText: 'OK',
      };

      beforeEach(() => {
        datasourceRequestMock.mockImplementation((options: { url: string }) => {
          const baseUrl =
            'http://azuremonitor.com/azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups';
          expect(options.url).toBe(baseUrl + '/nodeapp/resources?api-version=2018-01-01');
          return Promise.resolve(response);
        });
      });

      it('should return list of Resource Names', () => {
        return ctx.ds
          .getResourceNames('9935389e-9122-4ef9-95f9-1513dd24753f', 'nodeapp', 'microsoft.insights/components')
          .then((results: Array<{ text: string; value: string }>) => {
            expect(results.length).toEqual(1);
            expect(results[0].text).toEqual('nodeapp');
            expect(results[0].value).toEqual('nodeapp');
          });
      });
    });

    describe('and the metric definition is blobServices', () => {
      const response = {
        data: {
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
        },
        status: 200,
        statusText: 'OK',
      };

      beforeEach(() => {
        datasourceRequestMock.mockImplementation((options: { url: string }) => {
          const baseUrl =
            'http://azuremonitor.com/azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups';
          expect(options.url).toBe(baseUrl + '/nodeapp/resources?api-version=2018-01-01');
          return Promise.resolve(response);
        });
      });

      it('should return list of Resource Names', () => {
        return ctx.ds
          .getResourceNames(
            '9935389e-9122-4ef9-95f9-1513dd24753f',
            'nodeapp',
            'Microsoft.Storage/storageAccounts/blobServices'
          )
          .then((results: Array<{ text: string; value: string }>) => {
            expect(results.length).toEqual(1);
            expect(results[0].text).toEqual('storagetest/default');
            expect(results[0].value).toEqual('storagetest/default');
          });
      });
    });
  });

  describe('When performing getMetricNames', () => {
    const response = {
      data: {
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
      },
      status: 200,
      statusText: 'OK',
    };

    beforeEach(() => {
      datasourceRequestMock.mockImplementation((options: { url: string }) => {
        const baseUrl =
          'http://azuremonitor.com/azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups/nodeapp';
        const expected =
          baseUrl +
          '/providers/microsoft.insights/components/resource1' +
          '/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01&metricnamespace=default';
        expect(options.url).toBe(expected);
        return Promise.resolve(response);
      });
    });

    it('should return list of Metric Definitions', () => {
      return ctx.ds
        .getMetricNames(
          '9935389e-9122-4ef9-95f9-1513dd24753f',
          'nodeapp',
          'microsoft.insights/components',
          'resource1',
          'default'
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
      data: {
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
      },
      status: 200,
      statusText: 'OK',
    };

    beforeEach(() => {
      datasourceRequestMock.mockImplementation((options: { url: string }) => {
        const baseUrl =
          'http://azuremonitor.com/azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups/nodeapp';
        const expected =
          baseUrl +
          '/providers/microsoft.insights/components/resource1' +
          '/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01&metricnamespace=default';
        expect(options.url).toBe(expected);
        return Promise.resolve(response);
      });
    });

    it('should return Aggregation metadata for a Metric', () => {
      return ctx.ds
        .getMetricMetadata(
          '9935389e-9122-4ef9-95f9-1513dd24753f',
          'nodeapp',
          'microsoft.insights/components',
          'resource1',
          'default',
          'UsedCapacity'
        )
        .then((results: any) => {
          expect(results.primaryAggType).toEqual('Total');
          expect(results.supportedAggTypes.length).toEqual(6);
          expect(results.supportedTimeGrains.length).toEqual(4);
        });
    });
  });

  describe('When performing getMetricMetadata on metrics with dimensions', () => {
    const response = {
      data: {
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
      },
      status: 200,
      statusText: 'OK',
    };

    beforeEach(() => {
      datasourceRequestMock.mockImplementation((options: { url: string }) => {
        const baseUrl =
          'http://azuremonitor.com/azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups/nodeapp';
        const expected =
          baseUrl +
          '/providers/microsoft.insights/components/resource1' +
          '/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01&metricnamespace=default';
        expect(options.url).toBe(expected);
        return Promise.resolve(response);
      });
    });

    it('should return dimensions for a Metric that has dimensions', () => {
      return ctx.ds
        .getMetricMetadata(
          '9935389e-9122-4ef9-95f9-1513dd24753f',
          'nodeapp',
          'microsoft.insights/components',
          'resource1',
          'default',
          'Transactions'
        )
        .then((results: any) => {
          expect(results.dimensions.length).toEqual(4);
          expect(results.dimensions[0].text).toEqual('None');
          expect(results.dimensions[0].value).toEqual('None');
          expect(results.dimensions[1].text).toEqual('Response type');
          expect(results.dimensions[1].value).toEqual('ResponseType');
        });
    });

    it('should return an empty array for a Metric that does not have dimensions', () => {
      return ctx.ds
        .getMetricMetadata(
          '9935389e-9122-4ef9-95f9-1513dd24753f',
          'nodeapp',
          'microsoft.insights/components',
          'resource1',
          'default',
          'FreeCapacity'
        )
        .then((results: any) => {
          expect(results.dimensions.length).toEqual(0);
        });
    });
  });
});
