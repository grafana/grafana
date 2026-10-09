import { type DataSourceInstanceSettings } from '@grafana/data';
import { setDataSourceSrv, type DataSourceSrv, type RuntimeDataSource } from '@grafana/runtime';

import { getMockedDatasourceSrv } from '../utils/mocks';

import { registerRuntimeDataSourceInstance } from './registerRuntimeDataSourceInstance';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  registerRuntimeDataSourceInstance: undefined,
}));

const mockDatasourceSrv = getMockedDatasourceSrv();
const mockDataSource = {
  uid: 'runtime-ds',
  instanceSettings: { uid: 'runtime-ds' } as DataSourceInstanceSettings,
} as RuntimeDataSource;

describe('registerRuntimeDataSourceInstance', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setDataSourceSrv(mockDatasourceSrv);
  });

  it('should call correct function when registerRuntimeDataSourceInstance does not exists', () => {
    registerRuntimeDataSourceInstance({ dataSource: mockDataSource });

    expect(mockDatasourceSrv.registerRuntimeDataSource).toHaveBeenCalledTimes(1);
    expect(mockDatasourceSrv.registerRuntimeDataSource).toHaveBeenCalledWith({ dataSource: mockDataSource });
  });

  it('should throw when registerRuntimeDataSource throws', () => {
    mockDatasourceSrv.registerRuntimeDataSource.mockImplementation(() => {
      throw new Error('A runtime data source with uid runtime-ds has already been registered');
    });

    expect(() => registerRuntimeDataSourceInstance({ dataSource: mockDataSource })).toThrow(/already been registered/);
  });

  it('should throw when getDataSourceSrv is not setup', () => {
    setDataSourceSrv(undefined as unknown as DataSourceSrv);

    expect(() => registerRuntimeDataSourceInstance({ dataSource: mockDataSource })).toThrow();
  });
});
