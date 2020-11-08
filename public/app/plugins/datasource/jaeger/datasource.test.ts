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

it('uses direct datasource url and auth when configured', async () => {
  const backendSrvMock = makeBackendSrvMock('12345');
  await withMockedBackendSrv(backendSrvMock, async () => {
    const url = 'https://my-test-jaeger.com';
    const withCredentials = true;
    const settings: DataSourceInstanceSettings = { ...defaultSettings, url, withCredentials };
    const ds = new JaegerDatasource(settings);
    await ds.query(defaultQuery).toPromise();
    const { lastRequest } = backendSrvMock.sideEffects;
    expect(lastRequest.url).toBe(url + '/api/traces/12345');
    expect(lastRequest.withCredentials).toBe(true);
  });
});
  
function makeBackendSrvMock(traceId: string) {
  const sideEffects: any = {};
  return {
    sideEffects: sideEffects,
    datasourceRequest(options: BackendSrvRequest): Promise<any> {
      sideEffects.lastRequest = options;
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
