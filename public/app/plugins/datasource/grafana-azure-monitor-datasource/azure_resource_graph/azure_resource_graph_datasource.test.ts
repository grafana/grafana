import { TemplateSrv } from 'app/features/templating/template_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import AzureResourceGraphDatasource from './azure_resource_graph_datasource';

const templateSrv = new TemplateSrv();

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
    const target = {
      azureResourceGraph: {
        query: 'Resources | project name',
        resultFormat: '',
      },
    };

    it('should return Azure Resource Graph Query', () => {
      expect(ctx.ds.applyTemplateVariables(target)).toStrictEqual({
        azureResourceGraph: { query: 'Resources | project name', resultFormat: 'table' },
        format: undefined,
        queryType: 'Azure Resource Graph',
        refId: undefined,
        subscriptions: undefined,
      });
    });
  });

  describe('When interpolating variables', () => {
    const value = '4b439e23-e563-434c-9fab-e4e229ff0bc7';
    const variable = {
      multi: false,
      includeAll: false,
    };

    it('should return correct value', () => {
      expect(ctx.ds.interpolateVariable(value, variable)).toEqual('4b439e23-e563-434c-9fab-e4e229ff0bc7');
    });
  });
});
