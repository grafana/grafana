import { set, get } from 'lodash';

import { backendSrv } from 'app/core/services/backend_srv';
import { TemplateSrv } from 'app/features/templating/template_srv';

import createMockQuery from '../__mocks__/query';
import { createTemplateVariables } from '../__mocks__/utils';
import { multiVariable, singleVariable, subscriptionsVariable } from '../__mocks__/variables';
import AzureMonitorDatasource from '../datasource';
import { AzureQueryType } from '../types';

import AzureResourceGraphDatasource from './azure_resource_graph_datasource';

const templateSrv = new TemplateSrv({
  getVariables: () => [subscriptionsVariable, singleVariable, multiVariable],
  getVariableWithName: jest.fn(),
  getFilteredVariables: jest.fn(),
});

jest.mock('app/core/services/backend_srv');
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
  getTemplateSrv: () => templateSrv,
}));

describe('AzureResourceGraphDatasource', () => {
  const datasourceRequestMock = jest.spyOn(backendSrv, 'datasourceRequest');

  beforeEach(() => {
    jest.clearAllMocks();
    datasourceRequestMock.mockImplementation(jest.fn());
  });

  const ctx: any = {};

  beforeEach(() => {
    ctx.instanceSettings = {
      url: 'http://azureresourcegraphapi',
      jsonData: { subscriptionId: '9935389e-9122-4ef9-95f9-1513dd24753f', cloudName: 'azuremonitor' },
    };

    ctx.ds = new AzureResourceGraphDatasource(ctx.instanceSettings);
  });

  describe('When performing interpolateVariablesInQueries for azure_resource_graph', () => {
    beforeEach(() => {
      templateSrv.init([]);
    });

    it('should return a query unchanged if no template variables are provided', () => {
      const query = createMockQuery();
      query.queryType = AzureQueryType.AzureResourceGraph;
      const templatedQuery = ctx.ds.interpolateVariablesInQueries([query], {});
      expect(templatedQuery[0]).toEqual(query);
    });

    it('should return a query with any template variables replaced', () => {
      const templateableProps = ['query'];
      const templateVariables = createTemplateVariables(templateableProps);
      templateSrv.init(Array.from(templateVariables.values()).map((item) => item.templateVariable));
      const query = createMockQuery();
      const azureResourceGraph = {};
      for (const [path, templateVariable] of templateVariables.entries()) {
        set(azureResourceGraph, path, `$${templateVariable.variableName}`);
      }

      query.queryType = AzureQueryType.AzureResourceGraph;
      query.azureResourceGraph = {
        ...query.azureResourceGraph,
        ...azureResourceGraph,
      };
      const templatedQuery = ctx.ds.interpolateVariablesInQueries([query], {});
      expect(templatedQuery[0]).toHaveProperty('datasource');
      for (const [path, templateVariable] of templateVariables.entries()) {
        expect(get(templatedQuery[0].azureResourceGraph, path)).toEqual(
          templateVariable.templateVariable.current.value
        );
      }
    });
  });

  describe('When applying template variables', () => {
    beforeEach(() => {
      templateSrv.init([subscriptionsVariable, singleVariable, multiVariable]);
    });

    it('should expand single value template variable', () => {
      const target = {
        azureResourceGraph: {
          query: 'Resources | $var1',
          resultFormat: '',
        },
      };
      expect(ctx.ds.applyTemplateVariables(target)).toStrictEqual({
        azureResourceGraph: { query: 'Resources | var1-foo', resultFormat: 'table' },
        queryType: 'Azure Resource Graph',
        subscriptions: [],
      });
    });

    it('should expand multi value template variable', () => {
      const target = {
        azureResourceGraph: {
          query: 'resources | where $__contains(name, $var3)',
          resultFormat: '',
        },
      };
      expect(ctx.ds.applyTemplateVariables(target)).toStrictEqual({
        azureResourceGraph: {
          query: `resources | where $__contains(name, 'var3-foo','var3-baz')`,
          resultFormat: 'table',
        },
        queryType: 'Azure Resource Graph',
        subscriptions: [],
      });
    });
  });

  it('should apply subscription variable', () => {
    const target = {
      subscriptions: ['$subs'],
      azureResourceGraph: {
        query: 'resources | where $__contains(name, $var3)',
        resultFormat: '',
      },
    };
    expect(ctx.ds.applyTemplateVariables(target)).toStrictEqual({
      azureResourceGraph: {
        query: `resources | where $__contains(name, 'var3-foo','var3-baz')`,
        resultFormat: 'table',
      },
      queryType: 'Azure Resource Graph',
      subscriptions: ['sub-foo', 'sub-baz'],
    });
  });

  describe('When performing targetContainsTemplate', () => {
    it('should return false when no variable is being used', () => {
      const query = createMockQuery();
      const ds = new AzureMonitorDatasource(ctx.instanceSettings, templateSrv);
      query.queryType = AzureQueryType.AzureResourceGraph;
      expect(ds.targetContainsTemplate(query)).toEqual(false);
    });

    it('should return true when resource field is using a variable', () => {
      const query = createMockQuery();
      const templateSrv = new TemplateSrv();
      templateSrv.init([singleVariable]);

      const ds = new AzureMonitorDatasource(ctx.instanceSettings, templateSrv);
      query.queryType = AzureQueryType.AzureResourceGraph;
      query.azureResourceGraph = { query: `$${singleVariable.name}` };
      expect(ds.targetContainsTemplate(query)).toEqual(true);
    });

    it('should return true when resource field is using a variable in the subscriptions field', () => {
      const query = createMockQuery();
      const templateSrv = new TemplateSrv();
      templateSrv.init([multiVariable]);

      const ds = new AzureMonitorDatasource(ctx.instanceSettings, templateSrv);
      query.queryType = AzureQueryType.AzureResourceGraph;
      query.subscriptions = [multiVariable.name];
      query.azureResourceGraph = { query: `$${multiVariable.name}` };
      expect(ds.targetContainsTemplate(query)).toEqual(true);
    });

    it('should return false when a variable is used in a different part of the query', () => {
      const query = createMockQuery();
      const templateSrv = new TemplateSrv();
      templateSrv.init([singleVariable]);

      const ds = new AzureMonitorDatasource(ctx.instanceSettings, templateSrv);
      query.queryType = AzureQueryType.AzureResourceGraph;
      query.azureMonitor = { metricName: `$${singleVariable.name}` };
      expect(ds.targetContainsTemplate(query)).toEqual(false);
    });
  });
});
