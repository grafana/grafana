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

function makeBackendSrvMock(traceId: string) {
  return {
    datasourceRequest(options: BackendSrvRequest): Promise<any> {
      expect(options.url.substr(options.url.length - 17, options.url.length)).toBe(`/api/traces/${traceId}`);
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
