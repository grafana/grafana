import { BackendSrv, BackendSrvRequest } from 'src/services';
import { DataSourceWithBackend, standardStreamOptionsProvider, toStreamingDataResponse } from './DataSourceWithBackend';
import {
  DataSourceJsonData,
  DataQuery,
  DataSourceInstanceSettings,
  DataQueryRequest,
  DataQueryResponseData,
  MutableDataFrame,
} from '@grafana/data';
import { of } from 'rxjs';

class MyDataSource extends DataSourceWithBackend<DataQuery, DataSourceJsonData> {
  constructor(instanceSettings: DataSourceInstanceSettings<DataSourceJsonData>) {
    super(instanceSettings);
  }
}

const mockDatasourceRequest = jest.fn();

const backendSrv = ({
  fetch: (options: BackendSrvRequest) => {
    return of(mockDatasourceRequest(options));
  },
} as unknown) as BackendSrv;

jest.mock('../services', () => ({
  ...(jest.requireActual('../services') as any),
  getBackendSrv: () => backendSrv,
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: () => ({ id: 8674 }),
    };
  },
}));

describe('DataSourceWithBackend', () => {
  test('check the executed queries', () => {
    const settings = {
      name: 'test',
      id: 1234,
      jsonData: {},
    } as DataSourceInstanceSettings<DataSourceJsonData>;

    mockDatasourceRequest.mockReset();
    mockDatasourceRequest.mockReturnValue(Promise.resolve({}));
    const ds = new MyDataSource(settings);

    ds.query({
      maxDataPoints: 10,
      intervalMs: 5000,
      targets: [{ refId: 'A' }, { refId: 'B', datasource: 'sample' }],
    } as DataQueryRequest);

    const mock = mockDatasourceRequest.mock;
    expect(mock.calls.length).toBe(1);

    const args = mock.calls[0][0];
    expect(args).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "queries": Array [
            Object {
              "datasourceId": 1234,
              "intervalMs": 5000,
              "maxDataPoints": 10,
              "refId": "A",
            },
            Object {
              "datasource": "sample",
              "datasourceId": 8674,
              "intervalMs": 5000,
              "maxDataPoints": 10,
              "refId": "B",
            },
          ],
        },
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
});
