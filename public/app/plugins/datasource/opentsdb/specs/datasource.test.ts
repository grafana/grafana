import { of } from 'rxjs';

import { DataQueryRequest, dateTime } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { TemplateSrv } from 'app/features/templating/template_srv';

import { createFetchResponse } from '../../../../../test/helpers/createFetchResponse';
import OpenTsDatasource from '../datasource';
import { OpenTsdbQuery } from '../types';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
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
  function getTestcontext({ data = metricFindQueryData }: { data?: unknown } = {}) {
    jest.clearAllMocks();
    const fetchMock = jest.spyOn(backendSrv, 'fetch');
    fetchMock.mockImplementation(() => of(createFetchResponse(data)));

    const instanceSettings = { url: '', jsonData: { tsdbVersion: 1 } };
    const replace = jest.fn((value) => value);
    const templateSrv = {
      replace,
    } as unknown as TemplateSrv;

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

    it('should replace metric variable', () => {
      const { ds, templateSrv } = getTestcontext();
      const logQuery: OpenTsdbQuery = {
        refId: 'someRefId',
        metric: '$someVar',
        filters: [
          {
            type: 'type',
            tagk: 'someTagk',
            filter: 'someTagv',
            groupBy: true,
          },
        ],
      };

      ds.interpolateVariablesInQueries([logQuery], {});

      expect(templateSrv.replace).toHaveBeenCalledWith('$someVar', {});
      expect(templateSrv.replace).toHaveBeenCalledTimes(1);
    });

    it('should replace filter tag key and value', () => {
      const { ds, templateSrv } = getTestcontext();
      let logQuery: OpenTsdbQuery = {
        refId: 'A',
        datasource: {
          type: 'opentsdb',
          uid: 'P311D5F9D9B165031',
        },
        aggregator: 'sum',
        downsampleAggregator: 'avg',
        downsampleFillPolicy: 'none',
        metric: 'logins.count',
        filters: [
          {
            type: 'iliteral_or',
            tagk: '$someTagk',
            filter: '$someTagv',
            groupBy: false,
          },
        ],
      };

      const scopedVars = {
        __interval: {
          text: '20s',
          value: '20s',
        },
        __interval_ms: {
          text: '20000',
          value: 20000,
        },
      };

      const dataQR: DataQueryRequest<OpenTsdbQuery> = {
        app: 'dashboard',
        requestId: 'Q103',
        timezone: 'browser',
        panelId: 2,
        dashboardId: 189,
        dashboardUID: 'tyzmfPIVz',
        publicDashboardAccessToken: '',
        range: {
          from: dateTime('2022-10-19T08:55:18.430Z'),
          to: dateTime('2022-10-19T14:55:18.431Z'),
          raw: {
            from: 'now-6h',
            to: 'now',
          },
        },
        timeInfo: '',
        interval: '20s',
        intervalMs: 20000,
        targets: [logQuery],
        maxDataPoints: 909,
        scopedVars: scopedVars,
        startTime: 1666191318431,
        rangeRaw: {
          from: 'now-6h',
          to: 'now',
        },
      };

      ds.interpolateVariablesInFilters(logQuery, dataQR);

      expect(templateSrv.replace).toHaveBeenCalledWith('$someTagk', scopedVars, 'pipe');
      expect(templateSrv.replace).toHaveBeenCalledWith('$someTagv', scopedVars, 'pipe');

      expect(templateSrv.replace).toHaveBeenCalledTimes(2);
    });
  });
});
