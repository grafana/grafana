import { TemplateSrv } from 'app/features/templating/template_srv';

import { Context, createContext } from '../__mocks__/datasource';
import createMockQuery from '../__mocks__/query';
import { createTemplateVariables } from '../__mocks__/utils';
import { singleVariable } from '../__mocks__/variables';
import AzureMonitorDatasource from '../datasource';
import { AzureLogsQuery, AzureMonitorQuery, AzureQueryType } from '../types';

import FakeSchemaData from './__mocks__/schema';
import AzureLogAnalyticsDatasource from './azure_log_analytics_datasource';

const templateSrv = new TemplateSrv();

jest.mock('app/core/services/backend_srv');
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => templateSrv,
}));

describe('AzureLogAnalyticsDatasource', () => {
  let ctx: Context;

  beforeEach(() => {
    templateSrv.init([singleVariable]);
    templateSrv.getVariables = jest.fn().mockReturnValue([singleVariable]);
    ctx = createContext({
      instanceSettings: { jsonData: { subscriptionId: 'xxx' }, url: 'http://azureloganalyticsapi' },
    });
    ctx.templateSrv = templateSrv;
  });

  describe('When performing getSchema', () => {
    beforeEach(() => {
      ctx.getResource = jest.fn().mockImplementation((path: string) => {
        expect(path).toContain('metadata');
        return Promise.resolve(FakeSchemaData.getlogAnalyticsFakeMetadata());
      });
      ctx.datasource.azureLogAnalyticsDatasource.getResource = ctx.getResource;
    });

    it('should return a schema to use with monaco-kusto', async () => {
      const result = await ctx.datasource.azureLogAnalyticsDatasource.getKustoSchema('myWorkspace');

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
      await ctx.datasource.azureLogAnalyticsDatasource.getKustoSchema('myWorkspace/$var1');
      expect(ctx.getResource).lastCalledWith('loganalytics/v1myWorkspace/var1-foo/metadata');
    });

    it('should include macros as suggested functions', async () => {
      const result = await ctx.datasource.azureLogAnalyticsDatasource.getKustoSchema('myWorkspace');
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
      const result = await ctx.datasource.azureLogAnalyticsDatasource.getKustoSchema('myWorkspace');
      expect(result.globalParameters.map((f: { name: string }) => f.name)).toEqual([`$${singleVariable.name}`]);
    });
  });

  describe('When performing getWorkspaces', () => {
    beforeEach(() => {
      ctx.datasource.azureLogAnalyticsDatasource.getResource = jest
        .fn()
        .mockResolvedValue({ value: [{ name: 'foobar', id: 'foo', properties: { customerId: 'bar' } }] });
    });

    it('should return the workspace id', async () => {
      const workspaces = await ctx.datasource.azureLogAnalyticsDatasource.getWorkspaces('sub');
      expect(workspaces).toEqual([{ text: 'foobar', value: 'foo' }]);
    });
  });

  describe('When performing getFirstWorkspace', () => {
    beforeEach(() => {
      ctx.datasource.azureLogAnalyticsDatasource.getDefaultOrFirstSubscription = jest.fn().mockResolvedValue('foo');
      ctx.datasource.azureLogAnalyticsDatasource.getWorkspaces = jest
        .fn()
        .mockResolvedValue([{ text: 'foobar', value: 'foo' }]);
      ctx.datasource.azureLogAnalyticsDatasource.firstWorkspace = undefined;
    });

    it('should return the stored workspace', async () => {
      ctx.datasource.azureLogAnalyticsDatasource.firstWorkspace = 'bar';
      const workspace = await ctx.datasource.azureLogAnalyticsDatasource.getFirstWorkspace();
      expect(workspace).toEqual('bar');
      expect(ctx.datasource.azureLogAnalyticsDatasource.getDefaultOrFirstSubscription).not.toHaveBeenCalled();
    });

    it('should return the first workspace', async () => {
      const workspace = await ctx.datasource.azureLogAnalyticsDatasource.getFirstWorkspace();
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
      query.azureLogAnalytics = { resources: [`$${singleVariable.name}`] };
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
    let laDatasource: AzureLogAnalyticsDatasource;

    beforeEach(() => {
      laDatasource = new AzureLogAnalyticsDatasource(ctx.instanceSettings);
    });

    it('should run queries with a resource', () => {
      const query: AzureMonitorQuery = {
        refId: 'A',
        azureLogAnalytics: {
          resources: ['/sub/124/rg/cloud/vm/server'],
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
          resources: ['/sub/124/rg/cloud/vm/server'],
          query: 'perf | take 100',
        },
      };

      expect(laDatasource.filterQuery(query)).toBeFalsy();
    });

    it('should not run queries missing a kusto query', () => {
      const query: AzureMonitorQuery = {
        refId: 'A',
        azureLogAnalytics: {
          resources: ['/sub/124/rg/cloud/vm/server'],
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

  describe('When performing interpolateVariablesInQueries for azure_log_analytics', () => {
    beforeEach(() => {
      templateSrv.init([]);
    });

    it('should return a query unchanged if no template variables are provided', () => {
      const query = createMockQuery();
      query.queryType = AzureQueryType.LogAnalytics;
      const templatedQuery = ctx.datasource.interpolateVariablesInQueries([query], {});
      expect(templatedQuery[0]).toEqual(query);
    });

    it('should return a query with any template variables replaced', () => {
      const templateableProps = ['resource', 'workspace', 'query'];
      const templateVariables = createTemplateVariables(templateableProps);
      templateSrv.init(Array.from(templateVariables.values()).map((item) => item.templateVariable));
      const query = createMockQuery();
      const azureLogAnalytics: AzureLogsQuery = {};
      azureLogAnalytics.query = '$query';
      azureLogAnalytics.workspace = '$workspace';
      azureLogAnalytics.resources = ['$resource'];
      query.queryType = AzureQueryType.LogAnalytics;
      query.azureLogAnalytics = {
        ...query.azureLogAnalytics,
        ...azureLogAnalytics,
      };
      const templatedQuery = ctx.datasource.interpolateVariablesInQueries([query], {});
      expect(templatedQuery[0]).toHaveProperty('datasource');
      expect(templatedQuery[0].azureLogAnalytics).toMatchObject({
        query: templateVariables.get('query')?.templateVariable.current.value,
        workspace: templateVariables.get('workspace')?.templateVariable.current.value,
        resources: [templateVariables.get('resource')?.templateVariable.current.value],
      });
    });
  });
});
