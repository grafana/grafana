import { BackendSrv } from 'src/services';
import { DataSourceWithBackend } from './DataSourceWithBackend';
import { DataSourceJsonData, DataQuery, DataSourceInstanceSettings, DataQueryRequest } from '@grafana/data';

class MyDataSource extends DataSourceWithBackend<DataQuery, DataSourceJsonData> {
  constructor(instanceSettings: DataSourceInstanceSettings<DataSourceJsonData>) {
    super(instanceSettings);
  }
}

const mockDatasourceRequest = jest.fn();

const backendSrv = ({
  datasourceRequest: mockDatasourceRequest,
} as unknown) as BackendSrv;

jest.mock('../services', () => ({
  getBackendSrv: () => backendSrv,
}));
jest.mock('..', () => ({
  config: {
    bootData: {
      user: {
        orgId: 77,
      },
    },
    datasources: {
      sample: {
        id: 8674,
      },
    },
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
              "orgId": 77,
              "refId": "A",
            },
            Object {
              "datasource": "sample",
              "datasourceId": 8674,
              "intervalMs": 5000,
              "maxDataPoints": 10,
              "orgId": 77,
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
});
