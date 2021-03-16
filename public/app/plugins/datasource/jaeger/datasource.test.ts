import {
  ArrayVector,
  DataQueryRequest,
  DataSourceInstanceSettings,
  dateTime,
  FieldType,
  PluginType,
} from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';
import { of, throwError } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';
import { JaegerDatasource, JaegerQuery } from './datasource';
import { testResponse } from './testResponse';

jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getBackendSrv: () => backendSrv,
}));

describe('JaegerDatasource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns trace when queried', async () => {
    setupFetchMock({ data: [testResponse] });
    const ds = new JaegerDatasource(defaultSettings);
    await expect(ds.query(defaultQuery)).toEmitValuesWith((val) => {
      expect(val[0].data[0].fields).toMatchObject(
        [
          { name: 'traceID', values: ['3fa414edcef6ad90', '3fa414edcef6ad90'] },
          { name: 'spanID', values: ['3fa414edcef6ad90', '0f5c1808567e4403'] },
          { name: 'parentSpanID', values: [undefined, '3fa414edcef6ad90'] },
          { name: 'operationName', values: ['HTTP GET - api_traces_traceid', '/tempopb.Querier/FindTraceByID'] },
          { name: 'serviceName', values: ['tempo-querier', 'tempo-querier'] },
          {
            name: 'serviceTags',
            values: [
              [
                { key: 'cluster', type: 'string', value: 'ops-tools1' },
                { key: 'container', type: 'string', value: 'tempo-query' },
              ],
              [
                { key: 'cluster', type: 'string', value: 'ops-tools1' },
                { key: 'container', type: 'string', value: 'tempo-query' },
              ],
            ],
          },
          { name: 'startTime', values: [1605873894680.409, 1605873894680.587] },
          { name: 'duration', values: [1049.141, 1.847] },
          { name: 'logs', values: [[], []] },
          {
            name: 'tags',
            values: [
              [
                { key: 'sampler.type', type: 'string', value: 'probabilistic' },
                { key: 'sampler.param', type: 'float64', value: 1 },
              ],
              [
                { key: 'component', type: 'string', value: 'gRPC' },
                { key: 'span.kind', type: 'string', value: 'client' },
              ],
            ],
          },
          { name: 'warnings', values: [undefined, undefined] },
          { name: 'stackTraces', values: [undefined, undefined] },
        ].map((f) => ({ ...f, values: new ArrayVector<any>(f.values) }))
      );
    });
  });

  it('returns trace when traceId with special characters is queried', async () => {
    const mock = setupFetchMock({ data: [testResponse] });
    const ds = new JaegerDatasource(defaultSettings);
    const query = {
      ...defaultQuery,
      targets: [
        {
          query: 'a/b',
          refId: '1',
        },
      ],
    };
    await ds.query(query).toPromise();
    expect(mock).toBeCalledWith({ url: `${defaultSettings.url}/api/traces/a%2Fb` });
  });

  it('returns empty response if trace id is not specified', async () => {
    const ds = new JaegerDatasource(defaultSettings);
    const response = await ds
      .query({
        ...defaultQuery,
        targets: [],
      })
      .toPromise();
    const field = response.data[0].fields[0];
    expect(field.name).toBe('trace');
    expect(field.type).toBe(FieldType.trace);
    expect(field.values.length).toBe(0);
  });
});

describe('when performing testDataSource', () => {
  describe('and call succeeds', () => {
    it('should return successfully', async () => {
      setupFetchMock({ data: ['service1'] });

      const ds = new JaegerDatasource(defaultSettings);
      const response = await ds.testDatasource();
      expect(response.status).toEqual('success');
      expect(response.message).toBe('Data source connected and services found.');
    });
  });

  describe('and call succeeds, but returns no services', () => {
    it('should display an error', async () => {
      setupFetchMock(undefined);

      const ds = new JaegerDatasource(defaultSettings);
      const response = await ds.testDatasource();
      expect(response.status).toEqual('error');
      expect(response.message).toBe(
        'Data source connected, but no services received. Verify that Jaeger is configured properly.'
      );
    });
  });

  describe('and call returns error with message', () => {
    it('should return the formatted error', async () => {
      setupFetchMock(
        undefined,
        throwError({
          statusText: 'Not found',
          status: 404,
          data: {
            message: '404 page not found',
          },
        })
      );

      const ds = new JaegerDatasource(defaultSettings);
      const response = await ds.testDatasource();
      expect(response.status).toEqual('error');
      expect(response.message).toBe('Jaeger: Not found. 404. 404 page not found');
    });
  });

  describe('and call returns error without message', () => {
    it('should return JSON error', async () => {
      setupFetchMock(
        undefined,
        throwError({
          statusText: 'Bad gateway',
          status: 502,
          data: {
            errors: ['Could not connect to Jaeger backend'],
          },
        })
      );

      const ds = new JaegerDatasource(defaultSettings);
      const response = await ds.testDatasource();
      expect(response.status).toEqual('error');
      expect(response.message).toBe('Jaeger: Bad gateway. 502. {"errors":["Could not connect to Jaeger backend"]}');
    });
  });
});

function setupFetchMock(response: any, mock?: any) {
  const defaultMock = () => mock ?? of(createFetchResponse(response));

  const fetchMock = jest.spyOn(backendSrv, 'fetch');
  fetchMock.mockImplementation(defaultMock);
  return fetchMock;
}

const defaultSettings: DataSourceInstanceSettings = {
  id: 0,
  uid: '0',
  type: 'tracing',
  name: 'jaeger',
  url: 'http://grafana.com',
  meta: {
    id: 'jaeger',
    name: 'jaeger',
    type: PluginType.datasource,
    info: {} as any,
    module: '',
    baseUrl: '',
  },
  jsonData: {},
};

const defaultQuery: DataQueryRequest<JaegerQuery> = {
  requestId: '1',
  dashboardId: 0,
  interval: '0',
  intervalMs: 10,
  panelId: 0,
  scopedVars: {},
  range: {
    from: dateTime().subtract(1, 'h'),
    to: dateTime(),
    raw: { from: '1h', to: 'now' },
  },
  timezone: 'browser',
  app: 'explore',
  startTime: 0,
  targets: [
    {
      query: '12345',
      refId: '1',
    },
  ],
};
