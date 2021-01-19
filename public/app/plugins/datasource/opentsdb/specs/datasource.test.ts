import OpenTsDatasource from '../datasource';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { OpenTsdbQuery } from '../types';
import { createFetchResponse } from '../../../../../test/helpers/createFetchResponse';
import { of } from 'rxjs';

jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getBackendSrv: () => backendSrv,
}));

const metricFindQueryData = [
  {
    target: 'prod1.count',
    datapoints: [
      [10, 1],
      [12, 1],
    ],
  },
];

describe('opentsdb', () => {
  function getTestcontext({ data = metricFindQueryData }: { data?: any } = {}) {
    jest.clearAllMocks();
    const fetchMock = jest.spyOn(backendSrv, 'fetch');
    fetchMock.mockImplementation(() => of(createFetchResponse(data)));

    const instanceSettings = { url: '', jsonData: { tsdbVersion: 1 } };
    const replace = jest.fn((value) => value);
    const templateSrv: any = {
      replace,
    };

    const ds = new OpenTsDatasource(instanceSettings, templateSrv);

    return { ds, templateSrv, fetchMock };
  }

  describe('When performing metricFindQuery', () => {
    it('metrics() should generate api suggest query', async () => {
      const { ds, fetchMock } = getTestcontext();

      const results = await ds.metricFindQuery('metrics(pew)');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0].url).toBe('/api/suggest');
      expect(fetchMock.mock.calls[0][0].params?.type).toBe('metrics');
      expect(fetchMock.mock.calls[0][0].params?.q).toBe('pew');
      expect(results).not.toBe(null);
    });

    it('tag_names(cpu) should generate lookup query', async () => {
      const { ds, fetchMock } = getTestcontext();

      const results = await ds.metricFindQuery('tag_names(cpu)');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0].url).toBe('/api/search/lookup');
      expect(fetchMock.mock.calls[0][0].params?.m).toBe('cpu');
      expect(results).not.toBe(null);
    });

    it('tag_values(cpu, test) should generate lookup query', async () => {
      const { ds, fetchMock } = getTestcontext();

      const results = await ds.metricFindQuery('tag_values(cpu, hostname)');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0].url).toBe('/api/search/lookup');
      expect(fetchMock.mock.calls[0][0].params?.m).toBe('cpu{hostname=*}');
      expect(results).not.toBe(null);
    });

    it('tag_values(cpu, test) should generate lookup query', async () => {
      const { ds, fetchMock } = getTestcontext();

      const results = await ds.metricFindQuery('tag_values(cpu, hostname, env=$env)');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0].url).toBe('/api/search/lookup');
      expect(fetchMock.mock.calls[0][0].params?.m).toBe('cpu{hostname=*,env=$env}');
      expect(results).not.toBe(null);
    });

    it('tag_values(cpu, test) should generate lookup query', async () => {
      const { ds, fetchMock } = getTestcontext();

      const results = await ds.metricFindQuery('tag_values(cpu, hostname, env=$env, region=$region)');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0].url).toBe('/api/search/lookup');
      expect(fetchMock.mock.calls[0][0].params?.m).toBe('cpu{hostname=*,env=$env,region=$region}');
      expect(results).not.toBe(null);
    });

    it('suggest_tagk() should generate api suggest query', async () => {
      const { ds, fetchMock } = getTestcontext();

      const results = await ds.metricFindQuery('suggest_tagk(foo)');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0].url).toBe('/api/suggest');
      expect(fetchMock.mock.calls[0][0].params?.type).toBe('tagk');
      expect(fetchMock.mock.calls[0][0].params?.q).toBe('foo');
      expect(results).not.toBe(null);
    });

    it('suggest_tagv() should generate api suggest query', async () => {
      const { ds, fetchMock } = getTestcontext();

      const results = await ds.metricFindQuery('suggest_tagv(bar)');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0].url).toBe('/api/suggest');
      expect(fetchMock.mock.calls[0][0].params?.type).toBe('tagv');
      expect(fetchMock.mock.calls[0][0].params?.q).toBe('bar');
      expect(results).not.toBe(null);
    });
  });

  describe('When interpolating variables', () => {
    it('should return an empty array if no queries are provided', () => {
      const { ds } = getTestcontext();
      expect(ds.interpolateVariablesInQueries([], {})).toHaveLength(0);
    });

    it('should replace correct variables', () => {
      const { ds, templateSrv } = getTestcontext();
      const variableName = 'someVar';
      const logQuery: OpenTsdbQuery = {
        refId: 'someRefId',
        metric: `$${variableName}`,
      };

      ds.interpolateVariablesInQueries([logQuery], {});

      expect(templateSrv.replace).toHaveBeenCalledWith('$someVar', {});
      expect(templateSrv.replace).toHaveBeenCalledTimes(1);
    });
  });
});
