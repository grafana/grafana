import AzureMonitorDatasource from '../datasource';
import FakeSchemaData from './__mocks__/schema';
import Q from 'q';
import moment from 'moment';
import { TemplateSrv } from 'app/features/templating/template_srv';

describe('AzureLogAnalyticsDatasource', () => {
  const ctx: any = {
    backendSrv: {},
    templateSrv: new TemplateSrv(),
  };

  beforeEach(() => {
    ctx.$q = Q;
    ctx.instanceSettings = {
      jsonData: { logAnalyticsSubscriptionId: 'xxx' },
      url: 'http://azureloganalyticsapi',
    };

    ctx.ds = new AzureMonitorDatasource(ctx.instanceSettings, ctx.backendSrv, ctx.templateSrv, ctx.$q);
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

    let workspacesUrl;
    let azureLogAnalyticsUrl;

    beforeEach(async () => {
      ctx.instanceSettings.jsonData.subscriptionId = 'xxx';
      ctx.instanceSettings.jsonData.tenantId = 'xxx';
      ctx.instanceSettings.jsonData.clientId = 'xxx';
      ctx.instanceSettings.jsonData.azureLogAnalyticsSameAs = true;
      ctx.ds = new AzureMonitorDatasource(ctx.instanceSettings, ctx.backendSrv, ctx.templateSrv, ctx.$q);

      ctx.backendSrv.datasourceRequest = options => {
        if (options.url.indexOf('Microsoft.OperationalInsights/workspaces') > -1) {
          workspacesUrl = options.url;
          return ctx.$q.when({ data: workspaceResponse, status: 200 });
        } else {
          azureLogAnalyticsUrl = options.url;
          return ctx.$q.when({ data: tableResponseWithOneColumn, status: 200 });
        }
      };

      await ctx.ds.metricFindQuery('workspace("aworkspace").AzureActivity  | distinct Category');
    });

    it('should use the sameasloganalyticsazure plugin route', () => {
      expect(workspacesUrl).toContain('azuremonitor');
      expect(azureLogAnalyticsUrl).toContain('sameasloganalyticsazure');
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
        ctx.backendSrv.datasourceRequest = () => {
          return ctx.$q.reject(error);
        };
      });

      it('should return error status and a detailed error message', () => {
        return ctx.ds.testDatasource().then(results => {
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
        from: moment.utc('2017-08-22T20:00:00Z'),
        to: moment.utc('2017-08-22T23:59:00Z'),
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
      tables: [
        {
          name: 'PrimaryResult',
          columns: [
            {
              name: 'TimeGenerated',
              type: 'datetime',
            },
            {
              name: 'Category',
              type: 'string',
            },
            {
              name: 'count_',
              type: 'long',
            },
          ],
          rows: [
            ['2018-06-02T20:20:00Z', 'Administrative', 2],
            ['2018-06-02T20:25:00Z', 'Administrative', 22],
            ['2018-06-02T20:30:00Z', 'Policy', 20],
          ],
        },
      ],
    };

    describe('in time series format', () => {
      describe('and the data is valid (has time, metric and value columns)', () => {
        beforeEach(() => {
          ctx.backendSrv.datasourceRequest = options => {
            expect(options.url).toContain('query=AzureActivity');
            return ctx.$q.when({ data: response, status: 200 });
          };
        });

        it('should return a list of datapoints', () => {
          return ctx.ds.query(options).then(results => {
            expect(results.data.length).toBe(2);
            expect(results.data[0].datapoints.length).toBe(2);
            expect(results.data[0].target).toEqual('Administrative');
            expect(results.data[0].datapoints[0][1]).toEqual(1527970800000);
            expect(results.data[0].datapoints[0][0]).toEqual(2);
            expect(results.data[0].datapoints[1][1]).toEqual(1527971100000);
            expect(results.data[0].datapoints[1][0]).toEqual(22);
          });
        });
      });

      describe('and the data has no time column)', () => {
        beforeEach(() => {
          const invalidResponse = {
            tables: [
              {
                name: 'PrimaryResult',
                columns: [
                  {
                    name: 'Category',
                    type: 'string',
                  },
                  {
                    name: 'count_',
                    type: 'long',
                  },
                ],
                rows: [['Administrative', 2]],
              },
            ],
          };
          ctx.backendSrv.datasourceRequest = options => {
            expect(options.url).toContain('query=AzureActivity');
            return ctx.$q.when({ data: invalidResponse, status: 200 });
          };
        });

        it('should throw an exception', () => {
          ctx.ds.query(options).catch(err => {
            expect(err.message).toContain('The Time Series format requires a time column.');
          });
        });
      });
    });

    describe('in tableformat', () => {
      beforeEach(() => {
        options.targets[0].azureLogAnalytics.resultFormat = 'table';
        ctx.backendSrv.datasourceRequest = options => {
          expect(options.url).toContain('query=AzureActivity');
          return ctx.$q.when({ data: response, status: 200 });
        };
      });

      it('should return a list of columns and rows', () => {
        return ctx.ds.query(options).then(results => {
          expect(results.data[0].type).toBe('table');
          expect(results.data[0].columns.length).toBe(3);
          expect(results.data[0].rows.length).toBe(3);
          expect(results.data[0].columns[0].text).toBe('TimeGenerated');
          expect(results.data[0].columns[0].type).toBe('datetime');
          expect(results.data[0].columns[1].text).toBe('Category');
          expect(results.data[0].columns[1].type).toBe('string');
          expect(results.data[0].columns[2].text).toBe('count_');
          expect(results.data[0].columns[2].type).toBe('long');
          expect(results.data[0].rows[0][0]).toEqual('2018-06-02T20:20:00Z');
          expect(results.data[0].rows[0][1]).toEqual('Administrative');
          expect(results.data[0].rows[0][2]).toEqual(2);
        });
      });
    });
  });

  describe('When performing getSchema', () => {
    beforeEach(() => {
      ctx.backendSrv.datasourceRequest = options => {
        expect(options.url).toContain('metadata');
        return ctx.$q.when({ data: FakeSchemaData.getlogAnalyticsFakeMetadata(), status: 200 });
      };
    });

    it('should return a schema with a table and rows', () => {
      return ctx.ds.azureLogAnalyticsDatasource.getSchema('myWorkspace').then(result => {
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

    let queryResults;

    beforeEach(async () => {
      ctx.backendSrv.datasourceRequest = options => {
        if (options.url.indexOf('Microsoft.OperationalInsights/workspaces') > -1) {
          return ctx.$q.when({ data: workspaceResponse, status: 200 });
        } else {
          return ctx.$q.when({ data: tableResponseWithOneColumn, status: 200 });
        }
      };

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
          rows: [['2018-06-02T20:20:00Z', 'Computer1', 'tag1,tag2'], ['2018-06-02T20:28:00Z', 'Computer2', 'tag2']],
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

    let annotationResults;

    beforeEach(async () => {
      ctx.backendSrv.datasourceRequest = options => {
        if (options.url.indexOf('Microsoft.OperationalInsights/workspaces') > -1) {
          return ctx.$q.when({ data: workspaceResponse, status: 200 });
        } else {
          return ctx.$q.when({ data: tableResponse, status: 200 });
        }
      };

      annotationResults = await ctx.ds.annotationQuery({
        annotation: {
          rawQuery: 'Heartbeat | where $__timeFilter()| project TimeGenerated, Text=Computer, tags="test"',
          workspace: 'abc1b44e-3e57-4410-b027-6cc0ae6dee67',
        },
        range: {
          from: moment.utc('2017-08-22T20:00:00Z'),
          to: moment.utc('2017-08-22T23:59:00Z'),
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
