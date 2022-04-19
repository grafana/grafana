import { toUtc } from '@grafana/data';
import { TemplateSrv } from 'app/features/templating/template_srv';

import createMockQuery from '../__mocks__/query';
import { singleVariable } from '../__mocks__/variables';
import AzureMonitorDatasource from '../datasource';
import { AzureMonitorQuery, AzureQueryType, DatasourceValidationResult } from '../types';
import FakeSchemaData from './__mocks__/schema';
import AzureLogAnalyticsDatasource from './azure_log_analytics_datasource';

const templateSrv = new TemplateSrv();

jest.mock('app/core/services/backend_srv');
jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
  getTemplateSrv: () => templateSrv,
}));

const makeResourceURI = (
  resourceName: string,
  resourceGroup = 'test-resource-group',
  subscriptionID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
) =>
  `/subscriptions/${subscriptionID}/resourceGroups/${resourceGroup}/providers/Microsoft.OperationalInsights/workspaces/${resourceName}`;

describe('AzureLogAnalyticsDatasource', () => {
  const ctx: any = {};

  beforeEach(() => {
    templateSrv.init([singleVariable]);
    templateSrv.getVariables = jest.fn().mockReturnValue([singleVariable]);
    ctx.instanceSettings = {
      jsonData: { subscriptionId: 'xxx' },
      url: 'http://azureloganalyticsapi',
      templateSrv: templateSrv,
    };

    ctx.ds = new AzureMonitorDatasource(ctx.instanceSettings);
  });

  describe('When performing testDatasource', () => {
    beforeEach(() => {
      ctx.instanceSettings.jsonData.azureAuthType = 'msi';
    });

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
        ctx.ds.azureLogAnalyticsDatasource.getResource = jest.fn().mockRejectedValue(error);
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

    it('should not include double slashes when getting the resource', async () => {
      ctx.ds.azureLogAnalyticsDatasource.firstWorkspace = '/foo/bar';
      ctx.ds.azureLogAnalyticsDatasource.getResource = jest.fn().mockResolvedValue(true);
      await ctx.ds.azureLogAnalyticsDatasource.testDatasource();
      expect(ctx.ds.azureLogAnalyticsDatasource.getResource).toHaveBeenCalledWith('loganalytics/v1/foo/bar/metadata');
    });
  });

  describe('When performing getSchema', () => {
    beforeEach(() => {
      ctx.mockGetResource = jest.fn().mockImplementation((path: string) => {
        expect(path).toContain('metadata');
        return Promise.resolve(FakeSchemaData.getlogAnalyticsFakeMetadata());
      });
      ctx.ds.azureLogAnalyticsDatasource.getResource = ctx.mockGetResource;
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

    it('should interpolate variables when making a request for a schema with a uri that contains template variables', async () => {
      await ctx.ds.azureLogAnalyticsDatasource.getKustoSchema('myWorkspace/$var1');
      expect(ctx.mockGetResource).lastCalledWith('loganalytics/v1myWorkspace/var1-foo/metadata');
    });

    it('should include macros as suggested functions', async () => {
      const result = await ctx.ds.azureLogAnalyticsDatasource.getKustoSchema('myWorkspace');
      expect(result.database.functions.map((f: { name: string }) => f.name)).toEqual([
        'Func1',
        '_AzureBackup_GetVaults',
        '$__timeFilter',
        '$__timeFrom',
        '$__timeTo',
        '$__escapeMulti',
        '$__contains',
      ]);
    });

    it('should include template variables as global parameters', async () => {
      const result = await ctx.ds.azureLogAnalyticsDatasource.getKustoSchema('myWorkspace');
      expect(result.globalParameters.map((f: { name: string }) => f.name)).toEqual([
        `$${singleVariable.name}`,
        '$__timeFilter',
      ]);
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
      ctx.ds.azureLogAnalyticsDatasource.getResource = jest.fn().mockImplementation((path: string) => {
        if (path.indexOf('Microsoft.OperationalInsights/workspaces') > -1) {
          return Promise.resolve(workspaceResponse);
        } else {
          return Promise.resolve(tableResponse);
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

  describe('When performing getWorkspaces', () => {
    beforeEach(() => {
      ctx.ds.azureLogAnalyticsDatasource.getWorkspaceList = jest
        .fn()
        .mockResolvedValue({ value: [{ name: 'foobar', id: 'foo', properties: { customerId: 'bar' } }] });
    });

    it('should return the workspace id', async () => {
      const workspaces = await ctx.ds.azureLogAnalyticsDatasource.getWorkspaces('sub');
      expect(workspaces).toEqual([{ text: 'foobar', value: 'foo' }]);
    });
  });

  describe('When performing getFirstWorkspace', () => {
    beforeEach(() => {
      ctx.ds.azureLogAnalyticsDatasource.getDefaultOrFirstSubscription = jest.fn().mockResolvedValue('foo');
      ctx.ds.azureLogAnalyticsDatasource.getWorkspaces = jest
        .fn()
        .mockResolvedValue([{ text: 'foobar', value: 'foo' }]);
      ctx.ds.azureLogAnalyticsDatasource.firstWorkspace = undefined;
    });

    it('should return the stored workspace', async () => {
      ctx.ds.azureLogAnalyticsDatasource.firstWorkspace = 'bar';
      const workspace = await ctx.ds.azureLogAnalyticsDatasource.getFirstWorkspace();
      expect(workspace).toEqual('bar');
      expect(ctx.ds.azureLogAnalyticsDatasource.getDefaultOrFirstSubscription).not.toHaveBeenCalled();
    });

    it('should return the first workspace', async () => {
      const workspace = await ctx.ds.azureLogAnalyticsDatasource.getFirstWorkspace();
      expect(workspace).toEqual('foo');
    });
  });

  describe('When performing targetContainsTemplate', () => {
    it('should return false when no variable is being used', () => {
      const query = createMockQuery();
      const ds = new AzureMonitorDatasource(ctx.instanceSettings);
      query.queryType = AzureQueryType.LogAnalytics;
      expect(ds.targetContainsTemplate(query)).toEqual(false);
    });

    it('should return true when resource field is using a variable', () => {
      const templateSrv = new TemplateSrv();
      const query = createMockQuery();
      templateSrv.init([singleVariable]);

      const ds = new AzureMonitorDatasource(ctx.instanceSettings, templateSrv);
      query.queryType = AzureQueryType.LogAnalytics;
      query.azureLogAnalytics = { resource: `$${singleVariable.name}` };
      expect(ds.targetContainsTemplate(query)).toEqual(true);
    });

    it('should return false when a variable is used in a different part of the query', () => {
      const templateSrv = new TemplateSrv();
      const query = createMockQuery();
      templateSrv.init([singleVariable]);

      const ds = new AzureMonitorDatasource(ctx.instanceSettings, templateSrv);
      query.queryType = AzureQueryType.LogAnalytics;
      query.azureResourceGraph = { query: `$${singleVariable.name}` };
      expect(ds.targetContainsTemplate(query)).toEqual(false);
    });
  });

  describe('When performing filterQuery', () => {
    const ctx: any = {};
    let laDatasource: AzureLogAnalyticsDatasource;

    beforeEach(() => {
      ctx.instanceSettings = {
        jsonData: { subscriptionId: 'xxx' },
        url: 'http://azureloganalyticsapi',
      };

      laDatasource = new AzureLogAnalyticsDatasource(ctx.instanceSettings);
    });

    it('should run queries with a resource', () => {
      const query: AzureMonitorQuery = {
        refId: 'A',
        azureLogAnalytics: {
          resource: '/sub/124/rg/cloud/vm/server',
          query: 'perf | take 100',
        },
      };

      expect(laDatasource.filterQuery(query)).toBeTruthy();
    });

    it('should run queries with a workspace', () => {
      const query: AzureMonitorQuery = {
        refId: 'A',
        azureLogAnalytics: {
          query: 'perf | take 100',
          workspace: 'abc1b44e-3e57-4410-b027-6cc0ae6dee67',
        },
      };

      expect(laDatasource.filterQuery(query)).toBeTruthy();
    });

    it('should not run empty queries', () => {
      const query: AzureMonitorQuery = {
        refId: 'A',
      };

      expect(laDatasource.filterQuery(query)).toBeFalsy();
    });

    it('should not run hidden queries', () => {
      const query: AzureMonitorQuery = {
        refId: 'A',
        hide: true,
        azureLogAnalytics: {
          resource: '/sub/124/rg/cloud/vm/server',
          query: 'perf | take 100',
        },
      };

      expect(laDatasource.filterQuery(query)).toBeFalsy();
    });

    it('should not run queries missing a kusto query', () => {
      const query: AzureMonitorQuery = {
        refId: 'A',
        azureLogAnalytics: {
          resource: '/sub/124/rg/cloud/vm/server',
        },
      };

      expect(laDatasource.filterQuery(query)).toBeFalsy();
    });

    it('should not run queries missing a resource and a missing workspace', () => {
      const query: AzureMonitorQuery = {
        refId: 'A',
        azureLogAnalytics: {
          query: 'perf | take 100',
        },
      };

      expect(laDatasource.filterQuery(query)).toBeFalsy();
    });
  });
});
