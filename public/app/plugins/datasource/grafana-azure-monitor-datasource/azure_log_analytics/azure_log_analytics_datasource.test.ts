import AzureMonitorDatasource from '../datasource';
import FakeSchemaData from './__mocks__/schema';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { KustoSchema, AzureLogsVariable } from '../types';
import { toUtc, getFrameDisplayName } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__

jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getBackendSrv: () => backendSrv,
}));

describe('AzureLogAnalyticsDatasource', () => {
  const datasourceRequestMock = jest.spyOn(backendSrv, 'datasourceRequest');

  beforeEach(() => {
    jest.clearAllMocks();
    datasourceRequestMock.mockImplementation(jest.fn());
  });

  const ctx: any = {
    templateSrv: new TemplateSrv(),
  };

  beforeEach(() => {
    ctx.instanceSettings = {
      jsonData: { logAnalyticsSubscriptionId: 'xxx' },
      url: 'http://azureloganalyticsapi',
    };

    ctx.ds = new AzureMonitorDatasource(ctx.instanceSettings, ctx.templateSrv);
  });

  describe('When the config option "Same as Azure Monitor" has been chosen', () => {
    const tableResponseWithOneColumn = {
      tables: [
        {
          name: 'PrimaryResult',
          columns: [
            {
              name: 'Category',
              type: 'string',
            },
          ],
          rows: [['Administrative'], ['Policy']],
        },
      ],
    };

    const workspaceResponse = {
      value: [
        {
          name: 'aworkspace',
          properties: {
            source: 'Azure',
            customerId: 'abc1b44e-3e57-4410-b027-6cc0ae6dee67',
          },
        },
      ],
    };

    let workspacesUrl: string;
    let azureLogAnalyticsUrl: string;

    beforeEach(async () => {
      ctx.instanceSettings.jsonData.subscriptionId = 'xxx';
      ctx.instanceSettings.jsonData.tenantId = 'xxx';
      ctx.instanceSettings.jsonData.clientId = 'xxx';
      ctx.instanceSettings.jsonData.azureLogAnalyticsSameAs = true;
      ctx.ds = new AzureMonitorDatasource(ctx.instanceSettings, ctx.templateSrv);

      datasourceRequestMock.mockImplementation((options: { url: string }) => {
        if (options.url.indexOf('Microsoft.OperationalInsights/workspaces') > -1) {
          workspacesUrl = options.url;
          return Promise.resolve({ data: workspaceResponse, status: 200 });
        } else {
          azureLogAnalyticsUrl = options.url;
          return Promise.resolve({ data: tableResponseWithOneColumn, status: 200 });
        }
      });

      await ctx.ds.metricFindQuery('workspace("aworkspace").AzureActivity  | distinct Category');
    });

    it('should use the loganalyticsazure plugin route', () => {
      expect(workspacesUrl).toContain('azuremonitor');
      expect(azureLogAnalyticsUrl).toContain('loganalyticsazure');
    });
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
        ctx.instanceSettings.jsonData.logAnalyticsSubscriptionId = 'xxx';
        ctx.instanceSettings.jsonData.logAnalyticsTenantId = 'xxx';
        ctx.instanceSettings.jsonData.logAnalyticsClientId = 'xxx';
        datasourceRequestMock.mockImplementation(() => Promise.reject(error));
      });

      it('should return error status and a detailed error message', () => {
        return ctx.ds.testDatasource().then((results: any) => {
          expect(results.status).toEqual('error');
          expect(results.message).toEqual(
            '1. Azure Log Analytics: Bad Request: InvalidApiVersionParameter. An error message. '
          );
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
      rangeRaw: {
        from: 'now-4h',
        to: 'now',
      },
      targets: [
        {
          apiVersion: '2016-09-01',
          refId: 'A',
          queryType: 'Azure Log Analytics',
          azureLogAnalytics: {
            resultFormat: 'time_series',
            query:
              'AzureActivity | where TimeGenerated > ago(2h) ' +
              '| summarize count() by Category, bin(TimeGenerated, 5min) ' +
              '| project TimeGenerated, Category, count_  | order by TimeGenerated asc',
          },
        },
      ],
    };

    const response = {
      results: {
        A: {
          refId: 'A',
          meta: {
            columns: ['TimeGenerated', 'Computer', 'avg_CounterValue'],
            subscription: 'xxx',
            workspace: 'aaaa-1111-bbbb-2222',
            query:
              'Perf\r\n| where ObjectName == "Memory" and CounterName == "Available MBytes Memory"\n| where TimeGenerated >= datetime(\'2020-04-23T09:15:20Z\') and TimeGenerated <= datetime(\'2020-04-23T09:20:20Z\')\n| where  1 == 1\n| summarize avg(CounterValue) by bin(TimeGenerated, 1m), Computer \n| order by TimeGenerated asc',
            encodedQuery: 'gzipped_base64_encoded_query',
          },
          series: [
            {
              name: 'grafana-vm',
              points: [
                [2017.25, 1587633300000],
                [2048, 1587633360000],
                [2048.3333333333335, 1587633420000],
                [2049, 1587633480000],
                [2049, 1587633540000],
                [2049, 1587633600000],
              ],
            },
          ],
        },
      },
    };

    const workspacesResponse = {
      value: [
        {
          properties: {
            customerId: 'aaaa-1111-bbbb-2222',
          },
          id:
            '/subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourcegroups/defaultresourcegroup/providers/microsoft.operationalinsights/workspaces/aworkspace',
          name: 'aworkspace',
          type: 'Microsoft.OperationalInsights/workspaces',
        },
      ],
    };

    describe('in time series format', () => {
      describe('and the data is valid (has time, metric and value columns)', () => {
        beforeEach(() => {
          datasourceRequestMock.mockImplementation((options: { url: string }) => {
            if (options.url.indexOf('Microsoft.OperationalInsights/workspaces') > 0) {
              return Promise.resolve({ data: workspacesResponse, status: 200 });
            } else {
              expect(options.url).toContain('/api/tsdb/query');
              return Promise.resolve({ data: response, status: 200 });
            }
          });
        });

        it('should return a list of datapoints', () => {
          return ctx.ds.query(options).then((results: any) => {
            expect(results.data.length).toBe(1);
            expect(getFrameDisplayName(results.data[0])).toEqual('grafana-vm');
            expect(results.data[0].fields.length).toBe(2);
            expect(results.data[0].name).toBe('grafana-vm');
            expect(results.data[0].fields[0].name).toBe('Time');
            expect(results.data[0].fields[1].name).toBe('Value');
            expect(results.data[0].fields[0].values.toArray().length).toBe(6);
            expect(results.data[0].fields[0].values.get(0)).toEqual(1587633300000);
            expect(results.data[0].fields[1].values.get(0)).toEqual(2017.25);
            expect(results.data[0].fields[0].values.get(1)).toEqual(1587633360000);
            expect(results.data[0].fields[1].values.get(1)).toEqual(2048);
            expect(results.data[0].fields[0].config.links[0].title).toEqual('View in Azure Portal');
            expect(results.data[0].fields[0].config.links[0].targetBlank).toBe(true);
            expect(results.data[0].fields[0].config.links[0].url).toEqual(
              'https://portal.azure.com/#blade/Microsoft_OperationsManagementSuite_Workspace/AnalyticsBlade/initiator/AnalyticsShareLinkToQuery/isQueryEditorVisible/true/scope/%7B%22resources%22%3A%5B%7B%22resourceId%22%3A%22%2Fsubscriptions%2Fxxx%2Fresourcegroups%2Fdefaultresourcegroup%2Fproviders%2Fmicrosoft.operationalinsights%2Fworkspaces%2Faworkspace%22%7D%5D%7D/query/gzipped_base64_encoded_query/isQueryBase64Compressed/true/timespanInIsoFormat/P1D'
            );
          });
        });
      });
    });
  });

  describe('When performing getSchema', () => {
    beforeEach(() => {
      datasourceRequestMock.mockImplementation((options: { url: string }) => {
        expect(options.url).toContain('metadata');
        return Promise.resolve({ data: FakeSchemaData.getlogAnalyticsFakeMetadata(), status: 200 });
      });
    });

    it('should return a schema with a table and rows', () => {
      return ctx.ds.azureLogAnalyticsDatasource.getSchema('myWorkspace').then((result: KustoSchema) => {
        expect(Object.keys(result.Databases.Default.Tables).length).toBe(2);
        expect(result.Databases.Default.Tables.Alert.Name).toBe('Alert');
        expect(result.Databases.Default.Tables.AzureActivity.Name).toBe('AzureActivity');
        expect(result.Databases.Default.Tables.Alert.OrderedColumns.length).toBe(69);
        expect(result.Databases.Default.Tables.AzureActivity.OrderedColumns.length).toBe(21);
        expect(result.Databases.Default.Tables.Alert.OrderedColumns[0].Name).toBe('TimeGenerated');
        expect(result.Databases.Default.Tables.Alert.OrderedColumns[0].Type).toBe('datetime');

        expect(Object.keys(result.Databases.Default.Functions).length).toBe(1);
        expect(result.Databases.Default.Functions.Func1.Name).toBe('Func1');
      });
    });
  });

  describe('When performing metricFindQuery', () => {
    let queryResults: AzureLogsVariable[];

    const workspacesResponse = {
      value: [
        {
          name: 'workspace1',
          properties: {
            customerId: 'eeee4fde-1aaa-4d60-9974-eeee562ffaa1',
          },
        },
        {
          name: 'workspace2',
          properties: {
            customerId: 'eeee4fde-1aaa-4d60-9974-eeee562ffaa2',
          },
        },
      ],
    };

    describe('and is the workspaces() macro', () => {
      beforeEach(async () => {
        datasourceRequestMock.mockImplementation((options: { url: string }) => {
          expect(options.url).toContain('xxx');
          return Promise.resolve({ data: workspacesResponse, status: 200 });
        });

        queryResults = await ctx.ds.metricFindQuery('workspaces()');
      });

      it('should return a list of workspaces', () => {
        expect(queryResults.length).toBe(2);
        expect(queryResults[0].text).toBe('workspace1');
        expect(queryResults[0].value).toBe('eeee4fde-1aaa-4d60-9974-eeee562ffaa1');
        expect(queryResults[1].text).toBe('workspace2');
        expect(queryResults[1].value).toBe('eeee4fde-1aaa-4d60-9974-eeee562ffaa2');
      });
    });

    describe('and is the workspaces() macro with the subscription parameter', () => {
      beforeEach(async () => {
        datasourceRequestMock.mockImplementation((options: { url: string }) => {
          expect(options.url).toContain('11112222-eeee-4949-9b2d-9106972f9123');
          return Promise.resolve({ data: workspacesResponse, status: 200 });
        });

        queryResults = await ctx.ds.metricFindQuery('workspaces(11112222-eeee-4949-9b2d-9106972f9123)');
      });

      it('should return a list of workspaces', () => {
        expect(queryResults.length).toBe(2);
        expect(queryResults[0].text).toBe('workspace1');
        expect(queryResults[0].value).toBe('eeee4fde-1aaa-4d60-9974-eeee562ffaa1');
        expect(queryResults[1].text).toBe('workspace2');
        expect(queryResults[1].value).toBe('eeee4fde-1aaa-4d60-9974-eeee562ffaa2');
      });
    });

    describe('and is the workspaces() macro with the subscription parameter quoted', () => {
      beforeEach(async () => {
        datasourceRequestMock.mockImplementation((options: { url: string }) => {
          expect(options.url).toContain('11112222-eeee-4949-9b2d-9106972f9123');
          return Promise.resolve({ data: workspacesResponse, status: 200 });
        });

        queryResults = await ctx.ds.metricFindQuery('workspaces("11112222-eeee-4949-9b2d-9106972f9123")');
      });

      it('should return a list of workspaces', () => {
        expect(queryResults.length).toBe(2);
        expect(queryResults[0].text).toBe('workspace1');
        expect(queryResults[0].value).toBe('eeee4fde-1aaa-4d60-9974-eeee562ffaa1');
        expect(queryResults[1].text).toBe('workspace2');
        expect(queryResults[1].value).toBe('eeee4fde-1aaa-4d60-9974-eeee562ffaa2');
      });
    });

    describe('and is a custom query', () => {
      const tableResponseWithOneColumn = {
        tables: [
          {
            name: 'PrimaryResult',
            columns: [
              {
                name: 'Category',
                type: 'string',
              },
            ],
            rows: [['Administrative'], ['Policy']],
          },
        ],
      };

      const workspaceResponse = {
        value: [
          {
            name: 'aworkspace',
            properties: {
              source: 'Azure',
              customerId: 'abc1b44e-3e57-4410-b027-6cc0ae6dee67',
            },
          },
        ],
      };

      beforeEach(async () => {
        datasourceRequestMock.mockImplementation((options: { url: string }) => {
          if (options.url.indexOf('Microsoft.OperationalInsights/workspaces') > -1) {
            return Promise.resolve({ data: workspaceResponse, status: 200 });
          } else {
            return Promise.resolve({ data: tableResponseWithOneColumn, status: 200 });
          }
        });

        queryResults = await ctx.ds.metricFindQuery('workspace("aworkspace").AzureActivity  | distinct Category');
      });

      it('should return a list of categories in the correct format', () => {
        expect(queryResults.length).toBe(2);
        expect(queryResults[0].text).toBe('Administrative');
        expect(queryResults[0].value).toBe('Administrative');
        expect(queryResults[1].text).toBe('Policy');
        expect(queryResults[1].value).toBe('Policy');
      });
    });
  });

  describe('When performing annotationQuery', () => {
    const tableResponse = {
      tables: [
        {
          name: 'PrimaryResult',
          columns: [
            {
              name: 'TimeGenerated',
              type: 'datetime',
            },
            {
              name: 'Text',
              type: 'string',
            },
            {
              name: 'Tags',
              type: 'string',
            },
          ],
          rows: [
            ['2018-06-02T20:20:00Z', 'Computer1', 'tag1,tag2'],
            ['2018-06-02T20:28:00Z', 'Computer2', 'tag2'],
          ],
        },
      ],
    };

    const workspaceResponse = {
      value: [
        {
          name: 'aworkspace',
          properties: {
            source: 'Azure',
            customerId: 'abc1b44e-3e57-4410-b027-6cc0ae6dee67',
          },
        },
      ],
    };

    let annotationResults: any[];

    beforeEach(async () => {
      datasourceRequestMock.mockImplementation((options: { url: string }) => {
        if (options.url.indexOf('Microsoft.OperationalInsights/workspaces') > -1) {
          return Promise.resolve({ data: workspaceResponse, status: 200 });
        } else {
          return Promise.resolve({ data: tableResponse, status: 200 });
        }
      });

      annotationResults = await ctx.ds.annotationQuery({
        annotation: {
          rawQuery: 'Heartbeat | where $__timeFilter()| project TimeGenerated, Text=Computer, tags="test"',
          workspace: 'abc1b44e-3e57-4410-b027-6cc0ae6dee67',
        },
        range: {
          from: toUtc('2017-08-22T20:00:00Z'),
          to: toUtc('2017-08-22T23:59:00Z'),
        },
        rangeRaw: {
          from: 'now-4h',
          to: 'now',
        },
      });
    });

    it('should return a list of categories in the correct format', () => {
      expect(annotationResults.length).toBe(2);

      expect(annotationResults[0].time).toBe(1527970800000);
      expect(annotationResults[0].text).toBe('Computer1');
      expect(annotationResults[0].tags[0]).toBe('tag1');
      expect(annotationResults[0].tags[1]).toBe('tag2');

      expect(annotationResults[1].time).toBe(1527971280000);
      expect(annotationResults[1].text).toBe('Computer2');
      expect(annotationResults[1].tags[0]).toBe('tag2');
    });
  });
});
