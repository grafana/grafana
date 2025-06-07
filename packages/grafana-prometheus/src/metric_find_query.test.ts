// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/metric_find_query.test.ts
import { Observable, of } from 'rxjs';

import { DataSourceInstanceSettings, TimeRange, toUtc } from '@grafana/data';
import { BackendDataSourceResponse, BackendSrvRequest, FetchResponse, TemplateSrv } from '@grafana/runtime';

import { PrometheusDatasource } from './datasource';
import { getPrometheusTime } from './language_utils';
import { PrometheusMetricFindQuery } from './metric_find_query';
import { PromApplication, PromOptions } from './types';
import { escapeForUtf8Support } from './utf8_support';

const fetchMock = jest.fn((_: BackendSrvRequest): Observable<FetchResponse<BackendDataSourceResponse>> => {
  return of({} as unknown as FetchResponse);
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => {
    return {
      fetch: fetchMock,
    };
  },
}));

const instanceSettings = {
  url: 'proxied',
  id: 1,
  uid: 'ABCDEF',
  user: 'test',
  password: 'mupp',
  jsonData: {
    httpMethod: 'POST',
    prometheusVersion: '2.20.0',
    prometheusType: PromApplication.Prometheus,
  },
} as Partial<DataSourceInstanceSettings<PromOptions>> as DataSourceInstanceSettings<PromOptions>;
const raw: TimeRange = {
  from: toUtc('2018-04-25 10:00'),
  to: toUtc('2018-04-25 11:00'),
  raw: {
    from: '2018-04-25 10:00',
    to: '2018-04-25 11:00',
  },
};

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

  const setupMetricFindQuery = (
    data: {
      query: string;
      response: {
        data: unknown;
      };
    },
    datasource?: PrometheusDatasource
  ) => {
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
      const results = await query.process(raw);

      expect(results).toHaveLength(3);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        data: new URLSearchParams({ start: raw.from.unix().toString(), end: raw.to.unix().toString() }),
        method: 'POST',
        url: `/api/datasources/uid/ABCDEF/resources/api/v1/labels`,
        hideFromInspector: true,
        showErrorAlert: false,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Grafana-Cache': 'private, max-age=60',
        },
      });
    });

    it('label_values(resource) should generate label search query', async () => {
      const query = setupMetricFindQuery({
        query: 'label_values(resource)',
        response: {
          data: ['value1', 'value2', 'value3'],
        },
      });
      const results = await query.process(raw);

      expect(results).toHaveLength(3);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        data: { start: raw.from.unix().toString(), end: raw.to.unix().toString() },
        method: 'POST',
        url: `/api/datasources/uid/ABCDEF/resources/api/v1/label/resource/values`,
        hideFromInspector: true,
        showErrorAlert: false,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    });

    const emptyFilters = ['{}', '{   }', ' {   }  ', '   {}  '];

    emptyFilters.forEach((emptyFilter) => {
      const queryString = `label_values(${emptyFilter}, resource)`;
      it(`Empty filter, query, ${queryString} should just generate label search query`, async () => {
        const query = setupMetricFindQuery({
          query: queryString,
          response: {
            data: ['value1', 'value2', 'value3'],
          },
        });
        const results = await query.process(raw);

        expect(results).toHaveLength(3);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith({
          data: { start: raw.from.unix().toString(), end: raw.to.unix().toString() },
          method: 'POST',
          url: `/api/datasources/uid/ABCDEF/resources/api/v1/label/resource/values`,
          hideFromInspector: true,
          showErrorAlert: false,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
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
      const results = await query.process(raw);

      expect(results).toHaveLength(3);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        data: { start: raw.from.unix().toString(), end: raw.to.unix().toString(), 'match[]': 'metric' },
        method: 'POST',
        url: `/api/datasources/uid/ABCDEF/resources/api/v1/series`,
        hideFromInspector: true,
        showErrorAlert: false,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
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
      const results = await query.process(raw);

      expect(results).toHaveLength(3);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        data: {
          start: raw.from.unix().toString(),
          end: raw.to.unix().toString(),
          'match[]': 'metric{label1="foo", label2="bar", label3="baz"}',
        },
        method: 'POST',
        url: '/api/datasources/uid/ABCDEF/resources/api/v1/series',
        hideFromInspector: true,
        showErrorAlert: false,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
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
      const results = await query.process(raw);

      expect(results).toHaveLength(2);
      expect(results[0].text).toBe('value1');
      expect(results[1].text).toBe('value2');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        data: {
          start: raw.from.unix().toString(),
          end: raw.to.unix().toString(),
          'match[]': 'metric',
        },
        method: 'POST',
        url: `/api/datasources/uid/ABCDEF/resources/api/v1/series`,
        hideFromInspector: true,
        showErrorAlert: false,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
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
      const results = await query.process(raw);

      expect(results).toHaveLength(3);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        data: {
          start: raw.from.unix().toString(),
          end: raw.to.unix().toString(),
        },
        method: 'POST',
        url: `/api/datasources/uid/ABCDEF/resources/api/v1/label/__name__/values`,
        hideFromInspector: true,
        showErrorAlert: false,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
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
      const results = await query.process(raw);

      expect(results).toHaveLength(1);
      expect(results[0].text).toBe('metric{job="testjob"} 3846 1443454528000');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        data: {
          query: 'metric',
          time: raw.to.unix().toString(),
        },
        method: 'POST',
        url: `/api/datasources/uid/ABCDEF/resources/api/v1/query`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        hideFromInspector: true,
        showErrorAlert: false,
      });
    });

    it('query_result(metric) should pass time parameter to datasource.metric_find_query', async () => {
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
      const results = await query.process(raw);

      const expectedTime = getPrometheusTime(raw.to, true);

      expect(results).toHaveLength(1);
      expect(results[0].text).toBe('metric{job="testjob"} 3846 1443454528000');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        data: {
          time: expectedTime.toString(),
          query: 'metric',
        },
        method: 'POST',
        url: `/api/datasources/uid/ABCDEF/resources/api/v1/query`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        hideFromInspector: true,
        showErrorAlert: false,
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
      const results = await query.process(raw);
      expect(results).toHaveLength(1);
      expect(results[0].text).toBe('2');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        data: {
          query: '1+1',
          time: raw.to.unix().toString(),
        },
        method: 'POST',
        url: `/api/datasources/uid/ABCDEF/resources/api/v1/query`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        hideFromInspector: true,
        showErrorAlert: false,
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
      const results = await query.process(raw);

      expect(results).toHaveLength(3);
      expect(results[0].text).toBe('up{instance="127.0.0.1:1234",job="job1"}');
      expect(results[1].text).toBe('up{instance="127.0.0.1:5678",job="job1"}');
      expect(results[2].text).toBe('up{instance="127.0.0.1:9102",job="job1"}');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        data: {
          start: raw.from.unix().toString(),
          end: raw.to.unix().toString(),
          'match[]': `up{job="job1"}`,
        },
        method: 'POST',
        url: `/api/datasources/uid/ABCDEF/resources/api/v1/series`,
        hideFromInspector: true,
        showErrorAlert: false,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
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
      const results = await query.process(raw);

      expect(results).toHaveLength(3);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        data: {
          start: raw.from.unix().toString(),
          end: raw.to.unix().toString(),
          'match[]': `${metricName}`,
        },
        method: 'POST',
        url: `/api/datasources/uid/ABCDEF/resources/api/v1/label/${resourceName}/values`,
        hideFromInspector: true,
        showErrorAlert: false,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
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
      const results = await query.process(raw);

      expect(results).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith({
        data: {
          start: raw.from.unix().toString(),
          end: raw.to.unix().toString(),
          'match[]': `${metricName}{${label1Name}="${label1Value}"}`,
        },
        method: 'POST',
        url: `/api/datasources/uid/ABCDEF/resources/api/v1/label/${resourceName}/values`,
        hideFromInspector: true,
        showErrorAlert: false,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    });
    // </ ModernPrometheus>
    describe('utf8 metric and label support', () => {
      it('utf8 label - label_values(a_utf8_http_requests_total,instance.test) should generate label values query', () => {
        const metricName = 'a_utf8_http_requests_total';
        const label = 'instance.test';
        const query = `label_values(${metricName},${label})`;
        const metricFindQuery = new PrometheusMetricFindQuery(prometheusDatasource, query);
        metricFindQuery.process(raw);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith({
          data: {
            start: raw.from.unix().toString(),
            end: raw.to.unix().toString(),
            'match[]': `${metricName}`,
          },
          method: 'POST',
          url: `/api/datasources/uid/ABCDEF/resources/api/v1/label/${escapeForUtf8Support(label)}/values`,
          hideFromInspector: true,
          showErrorAlert: false,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
      });

      it('utf8 metric - label_values(utf8.http_requests_total,instance_test) should generate label values query', () => {
        const metricName = 'utf8.http_requests_total';
        const label = 'instance_test';
        const query = `label_values(${metricName},${label})`;
        const metricFindQuery = new PrometheusMetricFindQuery(prometheusDatasource, query);
        metricFindQuery.process(raw);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith({
          data: {
            start: raw.from.unix().toString(),
            end: raw.to.unix().toString(),
            'match[]': `${metricName}`,
          },
          method: 'POST',
          url: `/api/datasources/uid/ABCDEF/resources/api/v1/label/${label}/values`,
          hideFromInspector: true,
          showErrorAlert: false,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
      });

      it('utf8 metric and label - label_values(utf8.http_requests_total,instance.test) should generate label values query', () => {
        const metricName = 'utf8.http_requests_total';
        const label = 'instance.test';
        const query = `label_values(${metricName},${label})`;
        const metricFindQuery = new PrometheusMetricFindQuery(prometheusDatasource, query);
        metricFindQuery.process(raw);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith({
          data: {
            start: raw.from.unix().toString(),
            end: raw.to.unix().toString(),
            'match[]': `${metricName}`,
          },
          method: 'POST',
          url: `/api/datasources/uid/ABCDEF/resources/api/v1/label/${escapeForUtf8Support(label)}/values`,
          hideFromInspector: true,
          showErrorAlert: false,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
      });
    });
  });
});
