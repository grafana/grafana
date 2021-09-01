import { TemplateSrv } from 'app/features/templating/template_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import AzureResourceGraphDatasource from './azure_resource_graph_datasource';
import { CustomVariableModel, initialVariableModelState, VariableHide } from 'app/features/variables/types';

const single: CustomVariableModel = {
  ...initialVariableModelState,
  id: 'var1',
  name: 'var1',
  index: 0,
  current: { value: 'var1-foo', text: 'var1-foo', selected: true },
  options: [{ value: 'var1-foo', text: 'var1-foo', selected: true }],
  multi: false,
  includeAll: false,
  query: '',
  hide: VariableHide.dontHide,
  type: 'custom',
};

const multi: CustomVariableModel = {
  ...initialVariableModelState,
  id: 'var3',
  name: 'var3',
  index: 2,
  current: { value: ['var3-foo', 'var3-baz'], text: 'var3-foo + var3-baz', selected: true },
  options: [
    { selected: true, value: 'var3-foo', text: 'var3-foo' },
    { selected: false, value: 'var3-bar', text: 'var3-bar' },
    { selected: true, value: 'var3-baz', text: 'var3-baz' },
  ],
  multi: true,
  includeAll: false,
  query: '',
  hide: VariableHide.dontHide,
  type: 'custom',
};

const subs: CustomVariableModel = {
  ...initialVariableModelState,
  id: 'subs',
  name: 'subs',
  index: 3,
  current: { value: ['sub-foo', 'sub-baz'], text: 'sub-foo + sub-baz', selected: true },
  options: [
    { selected: true, value: 'sub-foo', text: 'sub-foo' },
    { selected: false, value: 'sub-bar', text: 'sub-bar' },
    { selected: true, value: 'sub-baz', text: 'sub-baz' },
  ],
  multi: true,
  includeAll: false,
  query: '',
  hide: VariableHide.dontHide,
  type: 'custom',
};

const templateSrv = new TemplateSrv({
  getVariables: () => [subs, single, multi],
  getVariableWithName: jest.fn(),
  getFilteredVariables: jest.fn(),
});
templateSrv.init([subs, single, multi]);

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
