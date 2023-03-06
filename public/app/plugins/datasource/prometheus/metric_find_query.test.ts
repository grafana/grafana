import 'whatwg-fetch'; // fetch polyfill needed backendSrv
import { of } from 'rxjs';

import { DataSourceInstanceSettings, toUtc } from '@grafana/data';
import { FetchResponse } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { TemplateSrv } from 'app/features/templating/template_srv';

import { PromApplication } from '../../../types/unified-alerting-dto';

import { PrometheusDatasource } from './datasource';
import PrometheusMetricFindQuery from './metric_find_query';
import { PromOptions } from './types';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

const fetchMock = jest.spyOn(backendSrv, 'fetch');

const instanceSettings = {
  url: 'proxied',
  id: 1,
  uid: 'ABCDEF',
  directUrl: 'direct',
  user: 'test',
  password: 'mupp',
  jsonData: { httpMethod: 'GET' },
} as Partial<DataSourceInstanceSettings<PromOptions>> as DataSourceInstanceSettings<PromOptions>;
const raw = {
  from: toUtc('2018-04-25 10:00'),
  to: toUtc('2018-04-25 11:00'),
};

jest.mock('app/features/dashboard/services/TimeSrv', () => ({
  __esModule: true,
  getTimeSrv: jest.fn().mockReturnValue({
    timeRange() {
      return {
        from: raw.from,
        to: raw.to,
        raw: raw,
      };
    },
  }),
}));

const templateSrvStub = {
  getAdhocFilters: jest.fn().mockImplementation(() => []),
  replace: jest.fn().mockImplementation((a: string) => a),
} as unknown as TemplateSrv;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PrometheusMetricFindQuery', () => {
  let legacyPrometheusDatasource: PrometheusDatasource;
  let prometheusDatasource: PrometheusDatasource;
  beforeEach(() => {
    legacyPrometheusDatasource = new PrometheusDatasource(instanceSettings, templateSrvStub);
    prometheusDatasource = new PrometheusDatasource(
      {
        ...instanceSettings,
        jsonData: { ...instanceSettings.jsonData, prometheusVersion: '2.2.0', prometheusType: PromApplication.Mimir },
      },
      templateSrvStub
    );
  });

  const setupMetricFindQuery = (data: any, datasource?: PrometheusDatasource) => {
    fetchMock.mockImplementation(() => of({ status: 'success', data: data.response } as unknown as FetchResponse));
    return new PrometheusMetricFindQuery(datasource ?? legacyPrometheusDatasource, data.query);
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
        url: `/api/datasources/uid/ABCDEF/resources/api/v1/labels?start=${raw.from.unix()}&end=${raw.to.unix()}`,
        hideFromInspector: true,
        showErrorAlert: false,
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
        url: `/api/datasources/uid/ABCDEF/resources/api/v1/label/resource/values?start=${raw.from.unix()}&end=${raw.to.unix()}`,
        hideFromInspector: true,
        headers: {},
      });
    });

    // <LegacyPrometheus>
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
        url: `/api/datasources/uid/ABCDEF/resources/api/v1/series?match${encodeURIComponent(
          '[]'
        )}=metric&start=${raw.from.unix()}&end=${raw.to.unix()}`,
        hideFromInspector: true,
        showErrorAlert: false,
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
        url: '/api/datasources/uid/ABCDEF/resources/api/v1/series?match%5B%5D=metric%7Blabel1%3D%22foo%22%2C%20label2%3D%22bar%22%2C%20label3%3D%22baz%22%7D&start=1524650400&end=1524654000',
        hideFromInspector: true,
        showErrorAlert: false,
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
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        method: 'GET',
        url: `/api/datasources/uid/ABCDEF/resources/api/v1/series?match${encodeURIComponent(
          '[]'
        )}=metric&start=${raw.from.unix()}&end=${raw.to.unix()}`,
        hideFromInspector: true,
        showErrorAlert: false,
        headers: {},
      });
    });
    // </LegacyPrometheus>

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
        url: `/api/datasources/uid/ABCDEF/resources/api/v1/label/__name__/values?start=${raw.from.unix()}&end=${raw.to.unix()}`,
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
      const results = await query.process();

      expect(results).toHaveLength(1);
      expect(results[0].text).toBe('metric{job="testjob"} 3846 1443454528000');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        method: 'GET',
        url: `/api/datasources/uid/ABCDEF/resources/api/v1/query?query=metric&time=${raw.to.unix()}`,
        requestId: undefined,
        headers: {},
      });
    });

    it('query_result(metric) should handle scalar resultTypes separately', async () => {
      const query = setupMetricFindQuery({
        query: 'query_result(1+1)',
        response: {
          data: {
            resultType: 'scalar',
            result: [1443454528.0, '2'],
          },
        },
      });
      const results = await query.process();
      expect(results).toHaveLength(1);
      expect(results[0].text).toBe('2');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        method: 'GET',
        url: `/api/datasources/uid/ABCDEF/resources/api/v1/query?query=1%2B1&time=${raw.to.unix()}`,
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
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        method: 'GET',
        url: `/api/datasources/uid/ABCDEF/resources/api/v1/series?match${encodeURIComponent('[]')}=${encodeURIComponent(
          'up{job="job1"}'
        )}&start=${raw.from.unix()}&end=${raw.to.unix()}`,
        hideFromInspector: true,
        showErrorAlert: false,
        headers: {},
      });
    });

    // <ModernPrometheus>
    it('label_values(metric, resource) should generate label values query with correct time', async () => {
      const metricName = 'metricName';
      const resourceName = 'resourceName';
      const query = setupMetricFindQuery(
        {
          query: `label_values(${metricName}, ${resourceName})`,
          response: {
            data: [
              { __name__: `${metricName}`, resourceName: 'value1' },
              { __name__: `${metricName}`, resourceName: 'value2' },
              { __name__: `${metricName}`, resourceName: 'value3' },
            ],
          },
        },
        prometheusDatasource
      );
      const results = await query.process();

      expect(results).toHaveLength(3);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        method: 'GET',
        url: `/api/datasources/uid/ABCDEF/resources/api/v1/label/${resourceName}/values?match${encodeURIComponent(
          '[]'
        )}=${metricName}&start=${raw.from.unix()}&end=${raw.to.unix()}`,
        hideFromInspector: true,
        headers: {},
      });
    });

    it('label_values(metric{label1="foo", label2="bar", label3="baz"}, resource) should generate label values query with correct time', async () => {
      const metricName = 'metricName';
      const resourceName = 'resourceName';
      const label1Name = 'label1';
      const label1Value = 'label1Value';
      const query = setupMetricFindQuery(
        {
          query: `label_values(${metricName}{${label1Name}="${label1Value}"}, ${resourceName})`,
          response: {
            data: [{ __name__: metricName, resourceName: label1Value }],
          },
        },
        prometheusDatasource
      );
      const results = await query.process();

      expect(results).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        method: 'GET',
        url: `/api/datasources/uid/ABCDEF/resources/api/v1/label/${resourceName}/values?match%5B%5D=${metricName}%7B${label1Name}%3D%22${label1Value}%22%7D&start=1524650400&end=1524654000`,
        hideFromInspector: true,
        headers: {},
      });
    });
    // </ ModernPrometheus>
  });
});
