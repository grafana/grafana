import { BackendSrv } from 'src/services';
import { DataSourceWithBackend } from './DataSourceWithBackend';
import { DataSourceJsonData, DataQuery, DataSourceInstanceSettings, DataQueryRequest } from '@grafana/data';

class MyDataSource extends DataSourceWithBackend<DataQuery, DataSourceJsonData> {
  constructor(instanceSettings: DataSourceInstanceSettings<DataSourceJsonData>) {
    super(instanceSettings);
  }
}

const backendSrv = ({
  datasourceRequest: jest.fn(),
} as unknown) as BackendSrv;

jest.mock('../services', () => ({
  getBackendSrv: () => backendSrv,
}));

describe('DataSourceWithBackend', () => {
  test('check the executed queries', () => {
    const settings = {
      name: 'test',
      id: 1234,
      jsonData: {},
    } as DataSourceInstanceSettings<DataSourceJsonData>;

    const ds = new MyDataSource(settings);
    ds.query({
      targets: [{ refId: 'A' }, { refId: 'B' }],
    } as DataQueryRequest);

    const mock = (backendSrv.datasourceRequest as any).mock;
    expect(mock.calls.length).toBe(1);
  });
});
