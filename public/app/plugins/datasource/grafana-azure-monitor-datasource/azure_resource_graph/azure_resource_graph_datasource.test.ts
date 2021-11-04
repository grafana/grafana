import { TemplateSrv } from 'app/features/templating/template_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import AzureResourceGraphDatasource from './azure_resource_graph_datasource';
import { multiVariable, singleVariable, subscriptionsVariable } from '../__mocks__/variables';

const templateSrv = new TemplateSrv({
  getVariables: () => [subscriptionsVariable, singleVariable, multiVariable],
  getVariableWithName: jest.fn(),
  getFilteredVariables: jest.fn(),
});
templateSrv.init([subscriptionsVariable, singleVariable, multiVariable]);

jest.mock('app/core/services/backend_srv');
jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
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
    };

    ctx.ds = new AzureResourceGraphDatasource(ctx.instanceSettings);
  });

  describe('When applying template variables', () => {
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
        refId: undefined,
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
        refId: undefined,
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
      refId: undefined,
      subscriptions: ['sub-foo', 'sub-baz'],
    });
  });
});
