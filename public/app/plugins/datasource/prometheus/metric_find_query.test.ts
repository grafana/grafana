import { PrometheusDatasource } from './datasource';
import PrometheusMetricFindQuery from './metric_find_query';
import { toUtc, DataSourceInstanceSettings } from '@grafana/data';
import { PromOptions } from './types';

import templateSrv from 'app/features/templating/template_srv';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import * as Backend from 'app/core/services/backend_srv';
import { BackendSrv } from '@grafana/runtime/src/services/backendSrv';

jest.mock('app/features/templating/template_srv', () => {
  return {
    getAdhocFilters: jest.fn(() => [] as any[]),
    replace: jest.fn((a: string) => a),
  };
});

const getAdhocFiltersMock = (templateSrv.getAdhocFilters as any) as jest.Mock<any>;
const replaceMock = (templateSrv.replace as any) as jest.Mock<any>;
jest.mock('app/core/services/backend_srv');

const backendSrvMock = {
  datasourceRequest: jest.fn(() => Promise.resolve({})),
};
const getBackendSrvMock = (Backend.getBackendSrv as any) as jest.Mock<BackendSrv>;
getBackendSrvMock.mockImplementation(() => backendSrvMock as any);

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

const getTimeSrvMock = (getTimeSrv as any) as jest.Mock<TimeSrv>;

beforeEach(() => {
  getBackendSrvMock.mockClear();
  getAdhocFiltersMock.mockClear();
  replaceMock.mockClear();
  getAdhocFiltersMock.mockClear();
  getTimeSrvMock.mockClear();
});

describe('PrometheusMetricFindQuery', () => {
  let datasourceRequestMock: any;
  let ds: PrometheusDatasource;
  beforeEach(() => {
    ds = new PrometheusDatasource(instanceSettings);
  });

  const setupMetricFindQuery = (data: any) => {
    datasourceRequestMock = jest.fn(() => Promise.resolve({ status: 'success', data: data.response }));
    getBackendSrvMock.mockImplementation(
      () =>
        ({
          datasourceRequest: datasourceRequestMock,
        } as any)
    );
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
      expect(datasourceRequestMock).toHaveBeenCalledTimes(1);
      expect(datasourceRequestMock).toHaveBeenCalledWith({
        method: 'GET',
        url: 'proxied/api/v1/labels',
        silent: true,
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
      expect(datasourceRequestMock).toHaveBeenCalledTimes(1);
      expect(datasourceRequestMock).toHaveBeenCalledWith({
        method: 'GET',
        url: 'proxied/api/v1/label/resource/values',
        silent: true,
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
      expect(datasourceRequestMock).toHaveBeenCalledTimes(1);
      expect(datasourceRequestMock).toHaveBeenCalledWith({
        method: 'GET',
        url: `proxied/api/v1/series?match[]=metric&start=${raw.from.unix()}&end=${raw.to.unix()}`,
        silent: true,
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
      expect(datasourceRequestMock).toHaveBeenCalledTimes(1);
      expect(datasourceRequestMock).toHaveBeenCalledWith({
        method: 'GET',
        url: `proxied/api/v1/series?match[]=${encodeURIComponent(
          'metric{label1="foo", label2="bar", label3="baz"}'
        )}&start=${raw.from.unix()}&end=${raw.to.unix()}`,
        silent: true,
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
      const results = await query.process();

      expect(results).toHaveLength(2);
      expect(results[0].text).toBe('value1');
      expect(results[1].text).toBe('value2');
      expect(datasourceRequestMock).toHaveBeenCalledTimes(1);
      expect(datasourceRequestMock).toHaveBeenCalledWith({
        method: 'GET',
        url: `proxied/api/v1/series?match[]=metric&start=${raw.from.unix()}&end=${raw.to.unix()}`,
        silent: true,
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
      expect(datasourceRequestMock).toHaveBeenCalledTimes(1);
      expect(datasourceRequestMock).toHaveBeenCalledWith({
        method: 'GET',
        url: 'proxied/api/v1/label/__name__/values',
        silent: true,
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
      const results = await query.process();

      expect(results).toHaveLength(1);
      expect(results[0].text).toBe('metric{job="testjob"} 3846 1443454528000');
      expect(datasourceRequestMock).toHaveBeenCalledTimes(1);
      expect(datasourceRequestMock).toHaveBeenCalledWith({
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
      const results = await query.process();

      expect(results).toHaveLength(3);
      expect(results[0].text).toBe('up{instance="127.0.0.1:1234",job="job1"}');
      expect(results[1].text).toBe('up{instance="127.0.0.1:5678",job="job1"}');
      expect(results[2].text).toBe('up{instance="127.0.0.1:9102",job="job1"}');
      expect(datasourceRequestMock).toHaveBeenCalledTimes(1);
      expect(datasourceRequestMock).toHaveBeenCalledWith({
        method: 'GET',
        url: `proxied/api/v1/series?match[]=${encodeURIComponent(
          'up{job="job1"}'
        )}&start=${raw.from.unix()}&end=${raw.to.unix()}`,
        silent: true,
        headers: {},
      });
    });
  });
});
