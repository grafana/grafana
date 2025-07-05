import { CustomVariableModel } from '@grafana/data';

import { Context, createContext } from '../mocks/datasource';
import createMockQuery from '../mocks/query';
import { singleVariable } from '../mocks/variables';
import { AzureLogsQuery, AzureMonitorQuery, AzureQueryType, AzureTracesQuery } from '../types/query';

import AzureLogAnalyticsDatasource from './azure_log_analytics_datasource';
import FakeSchemaData from './mocks/schema';

let getTempVars = () => [] as CustomVariableModel[];
let replace = () => '';

jest.mock('@grafana/runtime', () => {
  return {
    __esModule: true,
    ...jest.requireActual('@grafana/runtime'),
    getTemplateSrv: () => ({
      replace: replace,
      getVariables: getTempVars,
      updateTimeRange: jest.fn(),
      containsTemplate: jest.fn(),
    }),
  };
});

describe('AzureLogAnalyticsDatasource', () => {
  let ctx: Context;

  beforeEach(() => {
    ctx = createContext({
      instanceSettings: { jsonData: { subscriptionId: 'xxx' }, url: 'http://azureloganalyticsapi' },
    });
  });

  describe('When performing getSchema', () => {
    beforeEach(() => {
      getTempVars = () => [] as CustomVariableModel[];
      replace = (target?: string) => target || '';
      ctx = createContext();
      ctx.getResource = jest.fn().mockImplementation((path: string) => {
        expect(path).toContain('metadata');
        return Promise.resolve(FakeSchemaData.getlogAnalyticsFakeMetadata());
      });
      ctx.datasource.azureLogAnalyticsDatasource.getResource = ctx.getResource;
    });

    it('should return a schema to use with monaco-kusto', async () => {
      const { database } = await ctx.datasource.azureLogAnalyticsDatasource.getKustoSchema('myWorkspace');

      expect(database?.tables).toHaveLength(2);
      expect(database?.tables[0].name).toBe('Alert');
      expect(database?.tables[0].timespanColumn).toBe('TimeGenerated');
      expect(database?.tables[1].name).toBe('AzureActivity');
      expect(database?.tables[0].columns).toHaveLength(69);

      expect(database?.functions[1].inputParameters).toEqual([
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
      replace = () => 'myWorkspace/var1-foo';
      ctx = createContext();
      ctx.getResource = jest.fn().mockImplementation((path: string) => {
        expect(path).toContain('metadata');
        return Promise.resolve(FakeSchemaData.getlogAnalyticsFakeMetadata());
      });
      ctx.datasource.azureLogAnalyticsDatasource.getResource = ctx.getResource;
      await ctx.datasource.azureLogAnalyticsDatasource.getKustoSchema('myWorkspace/$var1');
      expect(ctx.getResource).lastCalledWith('loganalytics/v1myWorkspace/var1-foo/metadata');
    });

    it('should include macros as suggested functions', async () => {
      const result = await ctx.datasource.azureLogAnalyticsDatasource.getKustoSchema('myWorkspace');
      expect(result.database?.functions.map((f: { name: string }) => f.name)).toEqual([
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
      getTempVars = () => [singleVariable];
      ctx = createContext();
      ctx.getResource = jest.fn().mockImplementation((path: string) => {
        expect(path).toContain('metadata');
        return Promise.resolve(FakeSchemaData.getlogAnalyticsFakeMetadata());
      });
      ctx.datasource.azureLogAnalyticsDatasource.getResource = ctx.getResource;
      const result = await ctx.datasource.azureLogAnalyticsDatasource.getKustoSchema('myWorkspace');

      expect(result.globalScalarParameters?.map((f: { name: string }) => f.name)).toEqual([`$${singleVariable.name}`]);
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

    it('should not run traces queries missing a resource', () => {
      const query: AzureMonitorQuery = {
        refId: 'A',
        azureTraces: {
          resources: [],
        },
      };

      expect(laDatasource.filterQuery(query)).toBeFalsy();
    });
  });

  describe('When performing interpolateVariablesInQueries for azure_log_analytics', () => {
    beforeEach(() => {
      getTempVars = () => [] as CustomVariableModel[];
      replace = (target?: string) => target || '';
      ctx = createContext();
    });

    it('should return a query unchanged if no template variables are provided', () => {
      const query = createMockQuery();
      query.queryType = AzureQueryType.LogAnalytics;
      const templatedQuery = ctx.datasource.interpolateVariablesInQueries([query], {});
      expect(templatedQuery[0]).toEqual(query);
    });

    it('should return a logs query with any template variables replaced', () => {
      replace = (target?: string) => {
        if (target === '$var') {
          return 'template-variable';
        }
        return target || '';
      };
      ctx = createContext();
      const query = createMockQuery();
      const azureLogAnalytics: Partial<AzureLogsQuery> = {};
      azureLogAnalytics.query = '$var';
      azureLogAnalytics.workspace = '$var';
      azureLogAnalytics.resources = ['$var'];
      query.queryType = AzureQueryType.LogAnalytics;
      query.azureLogAnalytics = {
        ...query.azureLogAnalytics,
        ...azureLogAnalytics,
      };
      const templatedQuery = ctx.datasource.interpolateVariablesInQueries([query], {});
      expect(templatedQuery[0]).toHaveProperty('datasource');
      expect(templatedQuery[0].azureLogAnalytics).toMatchObject({
        query: 'template-variable',
        workspace: 'template-variable',
        resources: ['template-variable'],
      });
    });

    it('should return a logs query with multiple resources template variables replaced', () => {
      replace = () => 'resource1,resource2';
      ctx = createContext();
      const query = createMockQuery();
      const azureLogAnalytics: Partial<AzureLogsQuery> = {};
      azureLogAnalytics.resources = ['$resource'];
      query.queryType = AzureQueryType.LogAnalytics;
      query.azureLogAnalytics = {
        ...query.azureLogAnalytics,
        ...azureLogAnalytics,
      };
      const templatedQuery = ctx.datasource.interpolateVariablesInQueries([query], {});
      expect(templatedQuery[0]).toHaveProperty('datasource');
      expect(templatedQuery[0].azureLogAnalytics).toMatchObject({
        resources: ['resource1', 'resource2'],
      });
    });

    it('should return a traces query with any template variables replaced', () => {
      replace = (target?: string) => (target === '$var' ? 'template-variable' : target || '');
      ctx = createContext();
      const query = createMockQuery();
      const azureTraces: Partial<AzureTracesQuery> = {};
      azureTraces.resources = ['$var'];
      azureTraces.query = '$var';
      azureTraces.traceTypes = ['$var'];
      azureTraces.filters = [{ filters: ['$var'], operation: 'eq', property: '$var' }];
      azureTraces.operationId = '$var';
      query.queryType = AzureQueryType.AzureTraces;
      query.azureTraces = {
        ...query.azureTraces,
        ...azureTraces,
      };

      const templatedQuery = ctx.datasource.interpolateVariablesInQueries([query], {});
      expect(templatedQuery[0]).toHaveProperty('datasource');
      expect(templatedQuery[0].azureTraces).toMatchObject({
        query: 'template-variable',
        resources: ['template-variable'],
        operationId: 'template-variable',
        traceTypes: ['template-variable'],
        filters: [
          {
            filters: ['template-variable'],
            operation: 'eq',
            property: 'template-variable',
          },
        ],
      });
    });

    it('should return a trace query with multiple resources template variables replaced', () => {
      replace = () => 'resource1,resource2';
      ctx = createContext();
      const query = createMockQuery();
      const azureTraces: Partial<AzureTracesQuery> = {};
      azureTraces.resources = ['$resource'];
      query.queryType = AzureQueryType.AzureTraces;
      query.azureTraces = {
        ...query.azureTraces,
        ...azureTraces,
      };
      const templatedQuery = ctx.datasource.interpolateVariablesInQueries([query], {});
      expect(templatedQuery[0]).toHaveProperty('datasource');
      expect(templatedQuery[0].azureTraces).toMatchObject({
        resources: ['resource1', 'resource2'],
      });
    });
  });
});
