import { JaegerDatasource, JaegerQuery } from './datasource';
import { DataQueryRequest, DataSourceInstanceSettings, FieldType, PluginType, dateTime } from '@grafana/data';
import { BackendSrv, BackendSrvRequest, getBackendSrv, setBackendSrv } from '@grafana/runtime';

describe('JaegerDatasource', () => {
  it('returns trace when queried', async () => {
    await withMockedBackendSrv(makeBackendSrvMock('12345'), async () => {
      const ds = new JaegerDatasource(defaultSettings);
      const response = await ds.query(defaultQuery).toPromise();
      const field = response.data[0].fields[0];
      expect(field.name).toBe('trace');
      expect(field.type).toBe(FieldType.trace);
      expect(field.values.get(0)).toEqual({
        traceId: '12345',
      });
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
      const response = await ds.query(query).toPromise();
      const field = response.data[0].fields[0];
      expect(field.name).toBe('trace');
      expect(field.type).toBe(FieldType.trace);
      expect(field.values.get(0)).toEqual({
        traceId: 'a/b',
      });
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
          data: [
            {
              traceId,
            },
          ],
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
