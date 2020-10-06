import 'whatwg-fetch'; // fetch polyfill needed backendSrv
import { of } from 'rxjs';
import { DataSourceInstanceSettings, toUtc } from '@grafana/data';

import { PrometheusDatasource } from './datasource';
import PrometheusMetricFindQuery from './metric_find_query';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { PromOptions } from './types';
import { FetchResponse } from '@grafana/runtime';

jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getBackendSrv: () => backendSrv,
}));

const fetchMock = jest.spyOn(backendSrv, 'fetch');

const instanceSettings = ({
  url: 'proxied',
  directUrl: 'direct',
  user: 'test',
  password: 'mupp',
  jsonData: { httpMethod: 'GET' },
} as unknown) as DataSourceInstanceSettings<PromOptions>;
const raw = {
  from: toUtc('2018-04-25 10:00'),
  to: toUtc('2018-04-25 11:00'),
};

jest.mock('app/features/dashboard/services/TimeSrv', () => ({
  __esModule: true,
  getTimeSrv: jest.fn().mockReturnValue({
    timeRange(): any {
      return {
        from: raw.from,
        to: raw.to,
        raw: raw,
      };
    },
  }),
}));

const templateSrvStub = {
  getAdhocFilters: jest.fn(() => [] as any[]),
  replace: jest.fn((a: string) => a),
} as any;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PrometheusMetricFindQuery', () => {
  let ds: PrometheusDatasource;
  beforeEach(() => {
    ds = new PrometheusDatasource(instanceSettings, templateSrvStub);
  });

  const setupMetricFindQuery = (data: any) => {
    fetchMock.mockImplementation(() => of(({ status: 'success', data: data.response } as unknown) as FetchResponse));
    return new PrometheusMetricFindQuery(ds, data.query);
  };

  describe('When performing metricFindQuery', () => {
    it('label_names() should generate label name search query', async () => {
      const query = setupMetricFindQuery({
        query: 'label_names()',
        response: {
          data: ['name1', 'name2', 'name3'],
        },
      });
      const results = await query.process();

      expect(results).toHaveLength(3);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        method: 'GET',
        url: `proxied/api/v1/labels?start=${raw.from.unix()}&end=${raw.to.unix()}`,
        hideFromInspector: true,
        headers: {},
      });
    });

    it('label_values(resource) should generate label search query', async () => {
      const query = setupMetricFindQuery({
        query: 'label_values(resource)',
        response: {
          data: ['value1', 'value2', 'value3'],
        },
      });
      const results = await query.process();

      expect(results).toHaveLength(3);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        method: 'GET',
        url: `proxied/api/v1/label/resource/values?start=${raw.from.unix()}&end=${raw.to.unix()}`,
        hideFromInspector: true,
        headers: {},
      });
    });

    it('label_values(metric, resource) should generate series query with correct time', async () => {
      const query = setupMetricFindQuery({
        query: 'label_values(metric, resource)',
        response: {
          data: [
            { __name__: 'metric', resource: 'value1' },
            { __name__: 'metric', resource: 'value2' },
            { __name__: 'metric', resource: 'value3' },
          ],
        },
      });
      const results = await query.process();

      expect(results).toHaveLength(3);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        method: 'GET',
        url: `proxied/api/v1/series?match${encodeURIComponent(
          '[]'
        )}=metric&start=${raw.from.unix()}&end=${raw.to.unix()}`,
        hideFromInspector: true,
        headers: {},
      });
    });

    it('label_values(metric{label1="foo", label2="bar", label3="baz"}, resource) should generate series query with correct time', async () => {
      const query = setupMetricFindQuery({
        query: 'label_values(metric{label1="foo", label2="bar", label3="baz"}, resource)',
        response: {
          data: [
            { __name__: 'metric', resource: 'value1' },
            { __name__: 'metric', resource: 'value2' },
            { __name__: 'metric', resource: 'value3' },
          ],
        },
      });
      const results = await query.process();

      expect(results).toHaveLength(3);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        method: 'GET',
        url:
          'proxied/api/v1/series?match%5B%5D=metric%7Blabel1%3D%22foo%22%2C+label2%3D%22bar%22%2C+label3%3D%22baz%22%7D&start=1524650400&end=1524654000',
        hideFromInspector: true,
        headers: {},
      });
    });

    it('label_values(metric, resource) result should not contain empty string', async () => {
      const query = setupMetricFindQuery({
        query: 'label_values(metric, resource)',
        response: {
          data: [
            { __name__: 'metric', resource: 'value1' },
            { __name__: 'metric', resource: 'value2' },
            { __name__: 'metric', resource: '' },
          ],
        },
      });
      const results: any = await query.process();

      expect(results).toHaveLength(2);
      expect(results[0].text).toBe('value1');
      expect(results[1].text).toBe('value2');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        method: 'GET',
        url: `proxied/api/v1/series?match${encodeURIComponent(
          '[]'
        )}=metric&start=${raw.from.unix()}&end=${raw.to.unix()}`,
        hideFromInspector: true,
        headers: {},
      });
    });

    it('metrics(metric.*) should generate metric name query', async () => {
      const query = setupMetricFindQuery({
        query: 'metrics(metric.*)',
        response: {
          data: ['metric1', 'metric2', 'metric3', 'nomatch'],
        },
      });
      const results = await query.process();

      expect(results).toHaveLength(3);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        method: 'GET',
        url: `proxied/api/v1/label/__name__/values?start=${raw.from.unix()}&end=${raw.to.unix()}`,
        hideFromInspector: true,
        headers: {},
      });
    });

    it('query_result(metric) should generate metric name query', async () => {
      const query = setupMetricFindQuery({
        query: 'query_result(metric)',
        response: {
          data: {
            resultType: 'vector',
            result: [
              {
                metric: { __name__: 'metric', job: 'testjob' },
                value: [1443454528.0, '3846'],
              },
            ],
          },
        },
      });
      const results: any = await query.process();

      expect(results).toHaveLength(1);
      expect(results[0].text).toBe('metric{job="testjob"} 3846 1443454528000');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        method: 'GET',
        url: `proxied/api/v1/query?query=metric&time=${raw.to.unix()}`,
        requestId: undefined,
        headers: {},
      });
    });

    it('up{job="job1"} should fallback using generate series query', async () => {
      const query = setupMetricFindQuery({
        query: 'up{job="job1"}',
        response: {
          data: [
            { __name__: 'up', instance: '127.0.0.1:1234', job: 'job1' },
            { __name__: 'up', instance: '127.0.0.1:5678', job: 'job1' },
            { __name__: 'up', instance: '127.0.0.1:9102', job: 'job1' },
          ],
        },
      });
      const results: any = await query.process();

      expect(results).toHaveLength(3);
      expect(results[0].text).toBe('up{instance="127.0.0.1:1234",job="job1"}');
      expect(results[1].text).toBe('up{instance="127.0.0.1:5678",job="job1"}');
      expect(results[2].text).toBe('up{instance="127.0.0.1:9102",job="job1"}');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        method: 'GET',
        url: `proxied/api/v1/series?match${encodeURIComponent('[]')}=${encodeURIComponent(
          'up{job="job1"}'
        )}&start=${raw.from.unix()}&end=${raw.to.unix()}`,
        hideFromInspector: true,
        headers: {},
      });
    });
  });
});
