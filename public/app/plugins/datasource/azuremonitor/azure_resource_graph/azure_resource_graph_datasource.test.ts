import { set, get } from 'lodash';

import { CustomVariableModel } from '@grafana/data';

import { Context, createContext } from '../mocks/datasource';
import { createMockInstanceSetttings } from '../mocks/instanceSettings';
import createMockQuery from '../mocks/query';
import { createTemplateVariables } from '../mocks/utils';
import { multiVariable, singleVariable, subscriptionsVariable } from '../mocks/variables';
import { AzureQueryType } from '../types/query';

import AzureResourceGraphDatasource from './azure_resource_graph_datasource';

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

describe('AzureResourceGraphDatasource', () => {
  let ctx: Context;

  describe('When performing interpolateVariablesInQueries for azure_resource_graph', () => {
    beforeEach(() => {
      ctx = createContext({
        instanceSettings: {
          url: 'http://azureresourcegraphapi',
          jsonData: { subscriptionId: '9935389e-9122-4ef9-95f9-1513dd24753f', cloudName: 'azuremonitor' },
        },
      });
      getTempVars = () => [] as CustomVariableModel[];
      replace = (target?: string) => target || '';
    });

    it('should return a query unchanged if no template variables are provided', () => {
      const query = createMockQuery();
      query.queryType = AzureQueryType.AzureResourceGraph;
      const templatedQuery = ctx.datasource.interpolateVariablesInQueries([query], {});
      expect(templatedQuery).toEqual([query]);
    });

    it('should return a query with any template variables replaced', () => {
      const templateableProps = ['query'];
      const templateVariables = createTemplateVariables(templateableProps);
      replace = () => 'query-template-variable';
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
      const templatedQuery = ctx.datasource.interpolateVariablesInQueries([query], {});
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
      getTempVars = () => [] as CustomVariableModel[];
      replace = (target?: string) => target || '';
    });

    it('should expand single value template variable', () => {
      const target = createMockQuery({
        subscriptions: [],
        azureResourceGraph: {
          query: 'Resources | $var1',
          resultFormat: '',
        },
      });
      getTempVars = () =>
        Array.from([subscriptionsVariable, singleVariable, multiVariable].values()).map((item) => item);
      replace = (target?: string | undefined) =>
        target === 'Resources | $var1' ? 'Resources | var1-foo' : target || '';
      expect(ctx.datasource.azureResourceGraphDatasource.applyTemplateVariables(target, {})).toEqual(
        expect.objectContaining({
          ...target,
          azureResourceGraph: { query: 'Resources | var1-foo', resultFormat: 'table' },
          queryType: 'Azure Resource Graph',
          subscriptions: [],
        })
      );
    });

    it('should expand multi value template variable', () => {
      const target = createMockQuery({
        subscriptions: [],
        azureResourceGraph: {
          query: 'resources | where $__contains(name, $var3)',
          resultFormat: '',
        },
      });
      getTempVars = () =>
        Array.from([subscriptionsVariable, singleVariable, multiVariable].values()).map((item) => item);
      replace = (target?: string | undefined) => {
        if (target === 'resources | where $__contains(name, $var3)') {
          return "resources | where $__contains(name, 'var3-foo','var3-baz')";
        }
        return target || '';
      };
      expect(ctx.datasource.azureResourceGraphDatasource.applyTemplateVariables(target, {})).toEqual(
        expect.objectContaining({
          ...target,
          azureResourceGraph: {
            query: `resources | where $__contains(name, 'var3-foo','var3-baz')`,
            resultFormat: 'table',
          },
          queryType: 'Azure Resource Graph',
          subscriptions: [],
        })
      );
    });
  });

  it('should apply subscription variable', () => {
    const target = createMockQuery({
      subscriptions: ['$subs'],
      azureResourceGraph: {
        query: 'resources | where $__contains(name)',
        resultFormat: '',
      },
    });
    getTempVars = () => Array.from([subscriptionsVariable, singleVariable, multiVariable].values()).map((item) => item);
    replace = (target?: string | undefined) => (target === '$subs' ? 'sub-foo,sub-baz' : target || '');
    expect(ctx.datasource.azureResourceGraphDatasource.applyTemplateVariables(target, {})).toEqual(
      expect.objectContaining({
        azureResourceGraph: {
          query: `resources | where $__contains(name)`,
          resultFormat: 'table',
        },
        queryType: 'Azure Resource Graph',
        subscriptions: ['sub-foo', 'sub-baz'],
      })
    );
  });

  describe('pagedResourceGraphRequest', () => {
    it('makes multiple requests when it is returned a skip token', async () => {
      const instanceSettings = createMockInstanceSetttings();
      const datasource = new AzureResourceGraphDatasource(instanceSettings);
      const postResource = jest.fn();
      datasource.postResource = postResource;
      const mockResponses = [
        { data: ['some resource data'], $skipToken: 'skipToken' },
        { data: ['some more resource data'] },
      ];
      for (const response of mockResponses) {
        postResource.mockResolvedValueOnce(response);
      }

      await datasource.pagedResourceGraphRequest('some query');

      expect(postResource).toHaveBeenCalledTimes(2);
      const secondCall = postResource.mock.calls[1];
      const [_, postBody] = secondCall;
      expect(postBody.options.$skipToken).toEqual('skipToken');
    });
  });
});
