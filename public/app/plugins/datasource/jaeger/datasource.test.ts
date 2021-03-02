import { JaegerDatasource, JaegerQuery } from './datasource';
import {
  DataQueryRequest,
  DataSourceInstanceSettings,
  FieldType,
  PluginType,
  dateTime,
  ArrayVector,
} from '@grafana/data';
import { BackendSrv, BackendSrvRequest, getBackendSrv, setBackendSrv } from '@grafana/runtime';
import { testResponse } from './testResponse';

describe('JaegerDatasource', () => {
  it('returns trace when queried', async () => {
    await withMockedBackendSrv(makeBackendSrvMock('12345'), async () => {
      const ds = new JaegerDatasource(defaultSettings);
      const response = await ds.query(defaultQuery).toPromise();
      expect(response.data[0].fields).toMatchObject(
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
    await withMockedBackendSrv(makeBackendSrvMock('a/b'), async () => {
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
      // there is expect makeBackendSrvMock checking correct encoding
    });
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
      const backendSrvMock = makeTestDatasourceMock(
        Promise.resolve({
          statusText: 'OK',
          status: 200,
          data: {
            data: ['service1'],
          },
        })
      );

      await withMockedBackendSrv(backendSrvMock, async () => {
        const ds = new JaegerDatasource(defaultSettings);
        const response = await ds.testDatasource();
        expect(response.status).toEqual('success');
        expect(response.message).toBe('Data source connected and services found.');
      });
    });
  });

  describe('and call succeeds, but returns no services', () => {
    it('should display an error', async () => {
      const backendSrvMock = makeTestDatasourceMock(
        Promise.resolve({
          statusText: 'OK',
          status: 200,
        })
      );

      await withMockedBackendSrv(backendSrvMock, async () => {
        const ds = new JaegerDatasource(defaultSettings);
        const response = await ds.testDatasource();
        expect(response.status).toEqual('error');
        expect(response.message).toBe(
          'Data source connected, but no services received. Verify that Jaeger is configured properly.'
        );
      });
    });
  });

  describe('and call returns error with message', () => {
    it('should return the formatted error', async () => {
      const backendSrvMock = {
        datasourceRequest(options: BackendSrvRequest): Promise<any> {
          return Promise.reject({
            statusText: 'Not found',
            status: 404,
            data: {
              message: '404 page not found',
            },
          });
        },
      } as BackendSrv;

      await withMockedBackendSrv(backendSrvMock, async () => {
        const ds = new JaegerDatasource(defaultSettings);
        const response = await ds.testDatasource();
        expect(response.status).toEqual('error');
        expect(response.message).toBe('Jaeger: Not found. 404. 404 page not found');
      });
    });
  });

  describe('and call returns error without message', () => {
    it('should return JSON error', async () => {
      const backendSrvMock = {
        datasourceRequest(options: BackendSrvRequest): Promise<any> {
          return Promise.reject({
            statusText: 'Bad gateway',
            status: 502,
            data: {
              errors: ['Could not connect to Jaeger backend'],
            },
          });
        },
      } as BackendSrv;

      await withMockedBackendSrv(backendSrvMock, async () => {
        const ds = new JaegerDatasource(defaultSettings);
        const response = await ds.testDatasource();
        expect(response.status).toEqual('error');
        expect(response.message).toBe('Jaeger: Bad gateway. 502. {"errors":["Could not connect to Jaeger backend"]}');
      });
    });
  });
});

function makeTestDatasourceMock(result: Promise<any>) {
  return {
    datasourceRequest(options: BackendSrvRequest): Promise<any> {
      return result;
    },
  } as BackendSrv;
}

function makeBackendSrvMock(traceId: string) {
  return {
    datasourceRequest(options: BackendSrvRequest): Promise<any> {
      expect(options.url.substr(options.url.length - 17, options.url.length)).toBe(
        `/api/traces/${encodeURIComponent(traceId)}`
      );
      return Promise.resolve({
        data: {
          data: [testResponse],
        },
      });
    },
  } as any;
}

async function withMockedBackendSrv(srv: BackendSrv, fn: () => Promise<void>) {
  const oldSrv = getBackendSrv();
  setBackendSrv(srv);
  await fn();
  setBackendSrv(oldSrv);
}

const defaultSettings: DataSourceInstanceSettings = {
  id: 0,
  uid: '0',
  type: 'tracing',
  name: 'jaeger',
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
