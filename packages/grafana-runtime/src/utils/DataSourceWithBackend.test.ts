import { of } from 'rxjs';
import { BackendSrv, BackendSrvRequest, FetchResponse } from 'src/services';

import {
  DataQuery,
  DataQueryRequest,
  DataQueryResponseData,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  DataSourceRef,
  createDataFrame,
  AdHocVariableFilter,
  ScopedVars,
  getDefaultTimeRange,
} from '@grafana/data';

import { config } from '../config';

import {
  DataSourceWithBackend,
  isExpressionReference,
  standardStreamOptionsProvider,
  toStreamingDataResponse,
} from './DataSourceWithBackend';
import { publicDashboardQueryHandler } from './publicDashboardQueryHandler';

interface MyQuery extends DataQuery {
  filters?: AdHocVariableFilter[];
  applyTemplateVariablesCalled?: boolean;
}

class MyDataSource extends DataSourceWithBackend<MyQuery, DataSourceJsonData> {
  constructor(instanceSettings: DataSourceInstanceSettings<DataSourceJsonData>) {
    super(instanceSettings);
  }

  applyTemplateVariables(query: MyQuery, scopedVars: ScopedVars, filters?: AdHocVariableFilter[] | undefined): MyQuery {
    return { ...query, applyTemplateVariablesCalled: true, filters };
  }

  async getValue(key: string) {
    return await this.userStorage.getItem(key);
  }

  async setValue(key: string, value: string) {
    await this.userStorage.setItem(key, value);
  }
}

const mockDatasourceRequest = jest.fn<Promise<FetchResponse>, BackendSrvRequest[]>();

const backendSrv = {
  fetch: (options: BackendSrvRequest) => {
    return of(mockDatasourceRequest(options));
  },
} as unknown as BackendSrv;

jest.mock('../services', () => ({
  ...jest.requireActual('../services'),
  getBackendSrv: () => backendSrv,
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: (ref?: DataSourceRef) => ({
        type: ref?.type ?? '<mocktype>',
        uid: ref?.uid ?? '<mockuid>',
      }),
    };
  },
}));
jest.mock('./publicDashboardQueryHandler');

describe('DataSourceWithBackend', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-10-13'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('check the executed queries', () => {
    const { mock, ds } = createMockDatasource();
    ds.query({
      maxDataPoints: 10,
      intervalMs: 5000,
      targets: [{ refId: 'A' }, { refId: 'B', datasource: { type: 'sample' } }],
      dashboardUID: 'dashA',
      panelId: 123,
      filters: [{ key: 'key1', operator: '=', value: 'val1' }],
      range: getDefaultTimeRange(),
      queryGroupId: 'abc',
    } as DataQueryRequest);

    const args = mock.calls[0][0];

    expect(mock.calls.length).toBe(1);
    expect(args).toMatchInlineSnapshot(`
      {
        "data": {
          "from": "1697133600000",
          "queries": [
            {
              "applyTemplateVariablesCalled": true,
              "datasource": {
                "type": "dummy",
                "uid": "abc",
              },
              "datasourceId": 1234,
              "filters": [
                {
                  "key": "key1",
                  "operator": "=",
                  "value": "val1",
                },
              ],
              "intervalMs": 5000,
              "maxDataPoints": 10,
              "queryCachingTTL": undefined,
              "refId": "A",
            },
            {
              "datasource": {
                "type": "sample",
                "uid": "<mockuid>",
              },
              "datasourceId": undefined,
              "intervalMs": 5000,
              "maxDataPoints": 10,
              "queryCachingTTL": undefined,
              "refId": "B",
            },
          ],
          "to": "1697155200000",
        },
        "headers": {
          "X-Dashboard-Uid": "dashA",
          "X-Datasource-Uid": "abc, <mockuid>",
          "X-Panel-Id": "123",
          "X-Plugin-Id": "dummy, sample",
          "X-Query-Group-Id": "abc",
        },
        "hideFromInspector": false,
        "method": "POST",
        "requestId": undefined,
        "url": "/api/ds/query?ds_type=dummy",
      }
    `);
  });

  test('correctly passes datasource headers', () => {
    const { mock, ds } = createMockDatasource();
    ds.query({
      maxDataPoints: 10,
      intervalMs: 5000,
      targets: [{ refId: 'A' }, { refId: 'B', datasource: { type: 'sample' } }],
      dashboardUID: 'dashA',
      panelId: 123,
      filters: [{ key: 'key1', operator: '=', value: 'val1' }],
      range: getDefaultTimeRange(),
      queryGroupId: 'abc',
      interval: '5s',
      scopedVars: {},
      timezone: '',
      requestId: 'request-123',
      startTime: 0,
      app: '',
      headers: {
        'X-Test-Header': 'test',
      },
    });

    const args = mock.calls[0][0];

    expect(mock.calls.length).toBe(1);
    expect(args).toMatchInlineSnapshot(`
      {
        "data": {
          "from": "1697133600000",
          "queries": [
            {
              "applyTemplateVariablesCalled": true,
              "datasource": {
                "type": "dummy",
                "uid": "abc",
              },
              "datasourceId": 1234,
              "filters": [
                {
                  "key": "key1",
                  "operator": "=",
                  "value": "val1",
                },
              ],
              "intervalMs": 5000,
              "maxDataPoints": 10,
              "queryCachingTTL": undefined,
              "refId": "A",
            },
            {
              "datasource": {
                "type": "sample",
                "uid": "<mockuid>",
              },
              "datasourceId": undefined,
              "intervalMs": 5000,
              "maxDataPoints": 10,
              "queryCachingTTL": undefined,
              "refId": "B",
            },
          ],
          "to": "1697155200000",
        },
        "headers": {
          "X-Dashboard-Uid": "dashA",
          "X-Datasource-Uid": "abc, <mockuid>",
          "X-Panel-Id": "123",
          "X-Plugin-Id": "dummy, sample",
          "X-Query-Group-Id": "abc",
          "X-Test-Header": "test",
        },
        "hideFromInspector": false,
        "method": "POST",
        "requestId": "request-123",
        "url": "/api/ds/query?ds_type=dummy&requestId=request-123",
      }
    `);
  });

  test('correctly creates expression queries', () => {
    const { mock, ds } = createMockDatasource();
    ds.query({
      maxDataPoints: 10,
      intervalMs: 5000,
      targets: [{ refId: 'A' }, { refId: 'B', datasource: { type: '__expr__' } }],
      dashboardUID: 'dashA',
      panelId: 123,
      range: getDefaultTimeRange(),
      queryGroupId: 'abc',
    } as DataQueryRequest);

    const args = mock.calls[0][0];

    expect(mock.calls.length).toBe(1);
    expect(args).toMatchInlineSnapshot(`
      {
        "data": {
          "from": "1697133600000",
          "queries": [
            {
              "applyTemplateVariablesCalled": true,
              "datasource": {
                "type": "dummy",
                "uid": "abc",
              },
              "datasourceId": 1234,
              "filters": undefined,
              "intervalMs": 5000,
              "maxDataPoints": 10,
              "queryCachingTTL": undefined,
              "refId": "A",
            },
            {
              "datasource": {
                "name": "Expression",
                "type": "__expr__",
                "uid": "__expr__",
              },
              "refId": "B",
            },
          ],
          "to": "1697155200000",
        },
        "headers": {
          "X-Dashboard-Uid": "dashA",
          "X-Datasource-Uid": "abc",
          "X-Grafana-From-Expr": "true",
          "X-Panel-Id": "123",
          "X-Plugin-Id": "dummy",
          "X-Query-Group-Id": "abc",
        },
        "hideFromInspector": false,
        "method": "POST",
        "requestId": undefined,
        "url": "/api/ds/query?ds_type=dummy&expression=true",
      }
    `);
  });

  test('should apply template variables only for the current data source', () => {
    const { mock, ds } = createMockDatasource();
    ds.applyTemplateVariables = jest.fn();
    ds.query({
      maxDataPoints: 10,
      intervalMs: 5000,
      range: getDefaultTimeRange(),
      targets: [{ refId: 'A' }, { refId: 'B', datasource: { type: 'sample' } }],
    } as DataQueryRequest);

    expect(mock.calls.length).toBe(1);
    expect(ds.applyTemplateVariables).toHaveBeenCalledTimes(1);
  });

  test('check that the executed queries is hidden from inspector', () => {
    const { mock, ds } = createMockDatasource();
    ds.query({
      maxDataPoints: 10,
      intervalMs: 5000,
      targets: [{ refId: 'A' }, { refId: 'B', datasource: { type: 'sample' } }],
      hideFromInspector: true,
      dashboardUID: 'dashA',
      range: getDefaultTimeRange(),
      panelId: 123,
    } as DataQueryRequest);

    const args = mock.calls[0][0];

    expect(mock.calls.length).toBe(1);
    expect(args).toMatchInlineSnapshot(`
      {
        "data": {
          "from": "1697133600000",
          "queries": [
            {
              "applyTemplateVariablesCalled": true,
              "datasource": {
                "type": "dummy",
                "uid": "abc",
              },
              "datasourceId": 1234,
              "filters": undefined,
              "intervalMs": 5000,
              "maxDataPoints": 10,
              "queryCachingTTL": undefined,
              "refId": "A",
            },
            {
              "datasource": {
                "type": "sample",
                "uid": "<mockuid>",
              },
              "datasourceId": undefined,
              "intervalMs": 5000,
              "maxDataPoints": 10,
              "queryCachingTTL": undefined,
              "refId": "B",
            },
          ],
          "to": "1697155200000",
        },
        "headers": {
          "X-Dashboard-Uid": "dashA",
          "X-Datasource-Uid": "abc, <mockuid>",
          "X-Panel-Id": "123",
          "X-Plugin-Id": "dummy, sample",
        },
        "hideFromInspector": true,
        "method": "POST",
        "requestId": undefined,
        "url": "/api/ds/query?ds_type=dummy",
      }
    `);
  });

  test('it converts results with channels to streaming queries', () => {
    const request: DataQueryRequest = {
      intervalMs: 100,
    } as DataQueryRequest;

    const rsp: DataQueryResponseData = {
      data: [],
    };

    // Simple empty query
    let obs = toStreamingDataResponse(rsp, request, standardStreamOptionsProvider);
    expect(obs).toBeDefined();

    let frame = createDataFrame({
      meta: {
        channel: 'a/b/c',
      },
      fields: [],
    });
    rsp.data = [frame];
    obs = toStreamingDataResponse(rsp, request, standardStreamOptionsProvider);
    expect(obs).toBeDefined();
  });

  test('check that getResource uses the data source UID', () => {
    const { mock, ds } = createMockDatasource();
    ds.getResource('foo');

    const args = mock.calls[0][0];

    expect(mock.calls.length).toBe(1);
    expect(args).toMatchObject({
      headers: {
        'X-Datasource-Uid': 'abc',
        'X-Plugin-Id': 'dummy',
      },
      method: 'GET',
      url: '/api/datasources/uid/abc/resources/foo',
    });
  });

  test('check that postResource uses the data source UID', () => {
    const { mock, ds } = createMockDatasource();
    ds.postResource('foo');

    const args = mock.calls[0][0];

    expect(mock.calls.length).toBe(1);
    expect(args).toMatchObject({
      headers: {
        'X-Datasource-Uid': 'abc',
        'X-Plugin-Id': 'dummy',
      },
      method: 'POST',
      url: '/api/datasources/uid/abc/resources/foo',
    });
  });

  test('check that callHealthCheck uses the data source UID', () => {
    const { mock, ds } = createMockDatasource();
    ds.callHealthCheck();

    const args = mock.calls[0][0];

    expect(mock.calls.length).toBe(1);
    expect(args).toMatchObject({
      headers: {
        'X-Datasource-Uid': 'abc',
        'X-Plugin-Id': 'dummy',
      },
      method: 'GET',
      url: '/api/datasources/uid/abc/health',
    });
  });

  test('check that queries can skip the query cache', () => {
    const { mock, ds } = createMockDatasource();
    ds.query({
      maxDataPoints: 10,
      intervalMs: 5000,
      targets: [{ refId: 'A' }],
      dashboardUID: 'dashA',
      panelId: 123,
      range: getDefaultTimeRange(),
      skipQueryCache: true,
      requestId: 'request-123',
      interval: '5s',
      scopedVars: {},
      timezone: '',
      app: '',
      startTime: 0,
    });

    const args = mock.calls[0][0];

    expect(mock.calls.length).toBe(1);
    expect(args).toMatchInlineSnapshot(`
      {
        "data": {
          "from": "1697133600000",
          "queries": [
            {
              "applyTemplateVariablesCalled": true,
              "datasource": {
                "type": "dummy",
                "uid": "abc",
              },
              "datasourceId": 1234,
              "filters": undefined,
              "intervalMs": 5000,
              "maxDataPoints": 10,
              "queryCachingTTL": undefined,
              "refId": "A",
            },
          ],
          "to": "1697155200000",
        },
        "headers": {
          "X-Cache-Skip": "true",
          "X-Dashboard-Uid": "dashA",
          "X-Datasource-Uid": "abc",
          "X-Panel-Id": "123",
          "X-Plugin-Id": "dummy",
        },
        "hideFromInspector": false,
        "method": "POST",
        "requestId": "request-123",
        "url": "/api/ds/query?ds_type=dummy&requestId=request-123",
      }
    `);
  });

  describe('isExpressionReference', () => {
    test('check all possible expression references', () => {
      expect(isExpressionReference('__expr__')).toBeTruthy(); // New UID
      expect(isExpressionReference('-100')).toBeTruthy(); // Legacy UID
      expect(isExpressionReference('Expression')).toBeTruthy(); // Name
      expect(isExpressionReference({ type: '__expr__' })).toBeTruthy();
      expect(isExpressionReference({ type: '-100' })).toBeTruthy();
      expect(isExpressionReference(null)).toBeFalsy();
      expect(isExpressionReference(undefined)).toBeFalsy();
    });
  });

  describe('public dashboard scope', () => {
    test("check public dashboard handler is not executed when it's not public dashboard scope", () => {
      const { ds } = createMockDatasource();

      const request = {
        maxDataPoints: 10,
        intervalMs: 5000,
        targets: [{ refId: 'A' }, { refId: 'B', datasource: { type: 'sample' } }],
        dashboardUID: 'dashA',
        panelId: 123,
        queryGroupId: 'abc',
        range: getDefaultTimeRange(),
      } as DataQueryRequest;

      ds.query(request);

      expect(publicDashboardQueryHandler).not.toHaveBeenCalledWith(request);
    });

    test("check public dashboard handler is executed when it's public dashboard scope", () => {
      config.publicDashboardAccessToken = 'abc123';
      const { ds } = createMockDatasource();

      const request = {
        maxDataPoints: 10,
        intervalMs: 5000,
        targets: [{ refId: 'A' }, { refId: 'B', datasource: { type: 'sample' } }],
        dashboardUID: 'dashA',
        panelId: 123,
        queryGroupId: 'abc',
        range: getDefaultTimeRange(),
      } as DataQueryRequest;

      ds.query(request);

      expect(publicDashboardQueryHandler).toHaveBeenCalledWith(request);
    });
  });

  describe('user storage', () => {
    test('sets and gets a value', async () => {
      const { ds } = createMockDatasource();

      await ds.setValue('multiplier', '1');
      expect(await ds.getValue('multiplier')).toBe('1');
    });
  });
});

function createMockDatasource() {
  const settings = {
    name: 'test',
    id: 1234,
    uid: 'abc',
    type: 'dummy',
    jsonData: {},
  } as DataSourceInstanceSettings<DataSourceJsonData>;

  mockDatasourceRequest.mockReset();
  mockDatasourceRequest.mockReturnValue(Promise.resolve({} as FetchResponse));

  const ds = new MyDataSource(settings);
  return { ds, mock: mockDatasourceRequest.mock };
}
