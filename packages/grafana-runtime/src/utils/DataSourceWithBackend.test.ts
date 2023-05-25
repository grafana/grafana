import { of } from 'rxjs';
import { BackendSrv, BackendSrvRequest, FetchResponse } from 'src/services';

import {
  DataQuery,
  DataQueryRequest,
  DataQueryResponseData,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  DataSourceRef,
  MutableDataFrame,
} from '@grafana/data';

import {
  DataSourceWithBackend,
  isExpressionReference,
  standardStreamOptionsProvider,
  toStreamingDataResponse,
} from './DataSourceWithBackend';

class MyDataSource extends DataSourceWithBackend<DataQuery, DataSourceJsonData> {
  constructor(instanceSettings: DataSourceInstanceSettings<DataSourceJsonData>) {
    super(instanceSettings);
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
      getInstanceSettings: (ref?: DataSourceRef) => ({ type: ref?.type ?? '?', uid: ref?.uid ?? '?' }),
    };
  },
}));

describe('DataSourceWithBackend', () => {
  test('check the executed queries', () => {
    const mock = runQueryAndReturnFetchMock({
      maxDataPoints: 10,
      intervalMs: 5000,
      targets: [{ refId: 'A' }, { refId: 'B', datasource: { type: 'sample' } }],
    } as DataQueryRequest);

    const args = mock.calls[0][0];

    expect(mock.calls.length).toBe(1);
    expect(args).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "queries": Array [
            Object {
              "datasource": Object {
                "type": "dummy",
                "uid": "abc",
              },
              "datasourceId": 1234,
              "intervalMs": 5000,
              "maxDataPoints": 10,
              "refId": "A",
            },
            Object {
              "datasource": Object {
                "type": "sample",
                "uid": "?",
              },
              "datasourceId": undefined,
              "intervalMs": 5000,
              "maxDataPoints": 10,
              "refId": "B",
            },
          ],
        },
        "hideFromInspector": false,
        "method": "POST",
        "requestId": undefined,
        "url": "/api/ds/query",
      }
    `);
  });

  test('check that the executed queries is hidden from inspector', () => {
    const mock = runQueryAndReturnFetchMock({
      maxDataPoints: 10,
      intervalMs: 5000,
      targets: [{ refId: 'A' }, { refId: 'B', datasource: { type: 'sample' } }],
      hideFromInspector: true,
    } as DataQueryRequest);

    const args = mock.calls[0][0];

    expect(mock.calls.length).toBe(1);
    expect(args).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "queries": Array [
            Object {
              "datasource": Object {
                "type": "dummy",
                "uid": "abc",
              },
              "datasourceId": 1234,
              "intervalMs": 5000,
              "maxDataPoints": 10,
              "refId": "A",
            },
            Object {
              "datasource": Object {
                "type": "sample",
                "uid": "?",
              },
              "datasourceId": undefined,
              "intervalMs": 5000,
              "maxDataPoints": 10,
              "refId": "B",
            },
          ],
        },
        "hideFromInspector": true,
        "method": "POST",
        "requestId": undefined,
        "url": "/api/ds/query",
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

    let frame = new MutableDataFrame();
    frame.meta = {
      channel: 'a/b/c',
    };
    rsp.data = [frame];
    obs = toStreamingDataResponse(rsp, request, standardStreamOptionsProvider);
    expect(obs).toBeDefined();
  });

  describe('isExpressionReference', () => {
    test('check all possible expression references', () => {
      expect(isExpressionReference('__expr__')).toBeTruthy(); // New UID
      expect(isExpressionReference('-100')).toBeTruthy(); // Legacy UID
      expect(isExpressionReference('Expression')).toBeTruthy(); // Name
      expect(isExpressionReference({ type: '__expr__' })).toBeTruthy();
      expect(isExpressionReference({ type: '-100' })).toBeTruthy();
    });
  });
});

function runQueryAndReturnFetchMock(
  request: DataQueryRequest
): jest.MockContext<Promise<FetchResponse>, BackendSrvRequest[]> {
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
  ds.query(request);

  return mockDatasourceRequest.mock;
}
