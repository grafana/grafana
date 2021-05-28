import AzureMonitorDatasource from '../datasource';
import FakeSchemaData from './__mocks__/schema';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { AzureLogsVariable, DatasourceValidationResult } from '../types';
import { toUtc } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';

const templateSrv = new TemplateSrv();

jest.mock('app/core/services/backend_srv');
jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getBackendSrv: () => backendSrv,
  getTemplateSrv: () => templateSrv,
}));

const makeResourceURI = (
  resourceName: string,
  resourceGroup = 'test-resource-group',
  subscriptionID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
) =>
  `/subscriptions/${subscriptionID}/resourceGroups/${resourceGroup}/providers/Microsoft.OperationalInsights/workspaces/${resourceName}`;

describe('AzureLogAnalyticsDatasource', () => {
  const datasourceRequestMock = jest.spyOn(backendSrv, 'datasourceRequest');

  beforeEach(() => {
    jest.clearAllMocks();
    datasourceRequestMock.mockImplementation(jest.fn());
  });

  const ctx: any = {};

  beforeEach(() => {
    ctx.instanceSettings = {
      jsonData: { logAnalyticsSubscriptionId: 'xxx' },
      url: 'http://azureloganalyticsapi',
    };

    ctx.ds = new AzureMonitorDatasource(ctx.instanceSettings);
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
          id: makeResourceURI('a-workspace'),
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
      ctx.ds = new AzureMonitorDatasource(ctx.instanceSettings);

      datasourceRequestMock.mockImplementation((options: { url: string }) => {
        if (options.url.indexOf('Microsoft.OperationalInsights/workspaces?api-version') > -1) {
          workspacesUrl = options.url;
          return Promise.resolve({ data: workspaceResponse, status: 200 });
        } else {
          azureLogAnalyticsUrl = options.url;
          return Promise.resolve({ data: tableResponseWithOneColumn, status: 200 });
        }
      });
    });

    it('should use the loganalyticsazure plugin route', async () => {
      await ctx.ds.metricFindQuery('workspace("aworkspace").AzureActivity  | distinct Category');

      expect(workspacesUrl).toContain('workspacesloganalytics');
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
        ctx.instanceSettings.jsonData.azureAuthType = 'msi';
        datasourceRequestMock.mockImplementation(() => Promise.reject(error));
      });

      it('should return error status and a detailed error message', () => {
        return ctx.ds.azureLogAnalyticsDatasource.testDatasource().then((result: DatasourceValidationResult) => {
          expect(result.status).toEqual('error');
          expect(result.message).toEqual(
            'Azure Log Analytics requires access to Azure Monitor but had the following error: Bad Request: InvalidApiVersionParameter. An error message.'
          );
        });
      });
    });
  });

  describe('When performing getSchema', () => {
    beforeEach(() => {
      datasourceRequestMock.mockImplementation((options: { url: string }) => {
        expect(options.url).toContain('metadata');
        return Promise.resolve({ data: FakeSchemaData.getlogAnalyticsFakeMetadata(), status: 200, ok: true });
      });
    });

    it('should return a schema to use with monaco-kusto', async () => {
      const result = await ctx.ds.azureLogAnalyticsDatasource.getKustoSchema('myWorkspace');

      expect(result.database.tables).toHaveLength(2);
      expect(result.database.tables[0].name).toBe('Alert');
      expect(result.database.tables[0].timespanColumn).toBe('TimeGenerated');
      expect(result.database.tables[1].name).toBe('AzureActivity');
      expect(result.database.tables[0].columns).toHaveLength(69);

      expect(result.database.functions[1].inputParameters).toEqual([
        {
          name: 'RangeStart',
          type: 'datetime',
          defaultValue: 'datetime(null)',
          cslDefaultValue: 'datetime(null)',
        },
        {
          name: 'VaultSubscriptionList',
          type: 'string',
          defaultValue: '"*"',
          cslDefaultValue: '"*"',
        },
        {
          name: 'ExcludeLegacyEvent',
          type: 'bool',
          defaultValue: 'True',
          cslDefaultValue: 'True',
        },
      ]);
    });
  });

  describe('When performing metricFindQuery', () => {
    let queryResults: AzureLogsVariable[];

    const workspacesResponse = {
      value: [
        {
          name: 'workspace1',
          id: makeResourceURI('workspace-1'),
          properties: {
            customerId: 'eeee4fde-1aaa-4d60-9974-eeee562ffaa1',
          },
        },
        {
          name: 'workspace2',
          id: makeResourceURI('workspace-2'),
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
        expect(queryResults).toEqual([
          { text: 'workspace1', value: makeResourceURI('workspace-1') },
          { text: 'workspace2', value: makeResourceURI('workspace-2') },
        ]);
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
        expect(queryResults).toEqual([
          { text: 'workspace1', value: makeResourceURI('workspace-1') },
          { text: 'workspace2', value: makeResourceURI('workspace-2') },
        ]);
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
        expect(queryResults).toEqual([
          { text: 'workspace1', value: makeResourceURI('workspace-1') },
          { text: 'workspace2', value: makeResourceURI('workspace-2') },
        ]);
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
            id: makeResourceURI('a-workspace'),
            properties: {
              source: 'Azure',
              customerId: 'abc1b44e-3e57-4410-b027-6cc0ae6dee67',
            },
          },
        ],
      };

      beforeEach(async () => {
        datasourceRequestMock.mockImplementation((options: { url: string }) => {
          if (options.url.indexOf('OperationalInsights/workspaces?api-version=') > -1) {
            return Promise.resolve({ data: workspaceResponse, status: 200 });
          } else {
            return Promise.resolve({ data: tableResponseWithOneColumn, status: 200 });
          }
        });
      });

      it('should return a list of categories in the correct format', async () => {
        const results = await ctx.ds.metricFindQuery('workspace("aworkspace").AzureActivity  | distinct Category');

        expect(results.length).toBe(2);
        expect(results[0].text).toBe('Administrative');
        expect(results[0].value).toBe('Administrative');
        expect(results[1].text).toBe('Policy');
        expect(results[1].value).toBe('Policy');
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
          id: makeResourceURI('a-workspace'),
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
