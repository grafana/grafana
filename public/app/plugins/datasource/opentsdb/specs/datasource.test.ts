import OpenTsDatasource from '../datasource';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { OpenTsdbQuery } from '../types';

jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getBackendSrv: () => backendSrv,
}));

describe('opentsdb', () => {
  const datasourceRequestMock = jest.spyOn(backendSrv, 'datasourceRequest');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const ctx = {
    ds: {},
    templateSrv: {
      replace: (str: string) => str,
    },
  } as any;
  const instanceSettings = { url: '', jsonData: { tsdbVersion: 1 } };

  beforeEach(() => {
    ctx.ctrl = new OpenTsDatasource(instanceSettings, ctx.templateSrv);
  });

  describe('When performing metricFindQuery', () => {
    let results: any;
    let requestOptions: any;

    beforeEach(async () => {
      datasourceRequestMock.mockImplementation(
        await ((options: any) => {
          requestOptions = options;
          return Promise.resolve({
            data: [
              {
                target: 'prod1.count',
                datapoints: [
                  [10, 1],
                  [12, 1],
                ],
              },
            ],
          });
        })
      );
    });

    it('metrics() should generate api suggest query', () => {
      ctx.ctrl.metricFindQuery('metrics(pew)').then((data: any) => {
        results = data;
      });
      expect(requestOptions.url).toBe('/api/suggest');
      expect(requestOptions.params.type).toBe('metrics');
      expect(requestOptions.params.q).toBe('pew');
      expect(results).not.toBe(null);
    });

    it('tag_names(cpu) should generate lookup query', () => {
      ctx.ctrl.metricFindQuery('tag_names(cpu)').then((data: any) => {
        results = data;
      });
      expect(requestOptions.url).toBe('/api/search/lookup');
      expect(requestOptions.params.m).toBe('cpu');
    });

    it('tag_values(cpu, test) should generate lookup query', () => {
      ctx.ctrl.metricFindQuery('tag_values(cpu, hostname)').then((data: any) => {
        results = data;
      });
      expect(requestOptions.url).toBe('/api/search/lookup');
      expect(requestOptions.params.m).toBe('cpu{hostname=*}');
    });

    it('tag_values(cpu, test) should generate lookup query', () => {
      ctx.ctrl.metricFindQuery('tag_values(cpu, hostname, env=$env)').then((data: any) => {
        results = data;
      });
      expect(requestOptions.url).toBe('/api/search/lookup');
      expect(requestOptions.params.m).toBe('cpu{hostname=*,env=$env}');
    });

    it('tag_values(cpu, test) should generate lookup query', () => {
      ctx.ctrl.metricFindQuery('tag_values(cpu, hostname, env=$env, region=$region)').then((data: any) => {
        results = data;
      });
      expect(requestOptions.url).toBe('/api/search/lookup');
      expect(requestOptions.params.m).toBe('cpu{hostname=*,env=$env,region=$region}');
    });

    it('suggest_tagk() should generate api suggest query', () => {
      ctx.ctrl.metricFindQuery('suggest_tagk(foo)').then((data: any) => {
        results = data;
      });
      expect(requestOptions.url).toBe('/api/suggest');
      expect(requestOptions.params.type).toBe('tagk');
      expect(requestOptions.params.q).toBe('foo');
    });

    it('suggest_tagv() should generate api suggest query', () => {
      ctx.ctrl.metricFindQuery('suggest_tagv(bar)').then((data: any) => {
        results = data;
      });
      expect(requestOptions.url).toBe('/api/suggest');
      expect(requestOptions.params.type).toBe('tagv');
      expect(requestOptions.params.q).toBe('bar');
    });
  });

  describe('When interpolating variables', () => {
    beforeEach(() => {
      jest.clearAllMocks();

      ctx.mockedTemplateSrv = {
        replace: jest.fn(),
      };

      ctx.ds = new OpenTsDatasource(instanceSettings, ctx.mockedTemplateSrv);
    });

    it('should return an empty array if no queries are provided', () => {
      expect(ctx.ds.interpolateVariablesInQueries([], {})).toHaveLength(0);
    });

    it('should replace correct variables', () => {
      const variableName = 'someVar';
      const logQuery: OpenTsdbQuery = {
        refId: 'someRefId',
        metric: `$${variableName}`,
      };

      ctx.ds.interpolateVariablesInQueries([logQuery], {});

      expect(ctx.mockedTemplateSrv.replace).toHaveBeenCalledWith(`$${variableName}`, {});
      expect(ctx.mockedTemplateSrv.replace).toHaveBeenCalledTimes(1);
    });
  });
});
