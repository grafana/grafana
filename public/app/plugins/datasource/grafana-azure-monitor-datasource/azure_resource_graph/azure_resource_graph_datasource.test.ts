import { TemplateSrv } from 'app/features/templating/template_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import AzureResourceGraphDatasource from './azure_resource_graph_datasource';
import { CustomVariableModel, initialVariableModelState, VariableHide } from 'app/features/variables/types';
import { initialCustomVariableModelState } from 'app/features/variables/custom/reducer';

const templateSrv = new TemplateSrv();

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

templateSrv.init([single, multi]);

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
        subscriptions: undefined,
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
        subscriptions: undefined,
      });
    });
  });

  describe('When interpolating variables', () => {
    beforeEach(() => {
      ctx.variable = { ...initialCustomVariableModelState };
    });

    describe('and value is a string', () => {
      it('should return an unquoted value', () => {
        expect(ctx.ds.interpolateVariable('abc', ctx.variable)).toEqual('abc');
      });
    });

    describe('and value is a number', () => {
      it('should return an unquoted value', () => {
        expect(ctx.ds.interpolateVariable(1000, ctx.variable)).toEqual(1000);
      });
    });

    describe('and value is an array of strings', () => {
      it('should return comma separated quoted values', () => {
        expect(ctx.ds.interpolateVariable(['a', 'b', 'c'], ctx.variable)).toEqual("'a','b','c'");
      });
    });

    describe('and variable allows multi-value and value is a string', () => {
      it('should return a quoted value', () => {
        ctx.variable.multi = true;
        expect(ctx.ds.interpolateVariable('abc', ctx.variable)).toEqual("'abc'");
      });
    });

    describe('and variable contains single quote', () => {
      it('should return a quoted value', () => {
        ctx.variable.multi = true;
        expect(ctx.ds.interpolateVariable("a'bc", ctx.variable)).toEqual("'a'bc'");
      });
    });

    describe('and variable allows all and value is a string', () => {
      it('should return a quoted value', () => {
        ctx.variable.includeAll = true;
        expect(ctx.ds.interpolateVariable('abc', ctx.variable)).toEqual("'abc'");
      });
    });
  });
});
