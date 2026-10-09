import { type DataSourceInstanceSettings } from '@grafana/data';
import { type RuntimeDataSource } from '@grafana/runtime';
import { registerRuntimeDataSourceInstance as rtRegisterRuntimeDataSourceInstance } from '@grafana/runtime/unstable';

import { registerRuntimeDataSourceInstance } from './registerRuntimeDataSourceInstance';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  registerRuntimeDataSourceInstance: jest.fn(),
}));

const mockRuntimeRegisterRuntimeDataSourceInstance = jest.mocked(rtRegisterRuntimeDataSourceInstance);
const mockDataSource = {
  uid: 'runtime-ds',
  instanceSettings: { uid: 'runtime-ds' } as DataSourceInstanceSettings,
} as RuntimeDataSource;

describe('registerRuntimeDataSourceInstance', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should call correct function when registerRuntimeDataSourceInstance exists', () => {
    registerRuntimeDataSourceInstance({ dataSource: mockDataSource });

    expect(mockRuntimeRegisterRuntimeDataSourceInstance).toHaveBeenCalledTimes(1);
    expect(mockRuntimeRegisterRuntimeDataSourceInstance).toHaveBeenCalledWith({ dataSource: mockDataSource });
  });

  it('should throw when registerRuntimeDataSourceInstance throws', () => {
    mockRuntimeRegisterRuntimeDataSourceInstance.mockImplementation(() => {
      throw new Error('A runtime data source with uid runtime-ds has already been registered');
    });

    expect(() => registerRuntimeDataSourceInstance({ dataSource: mockDataSource })).toThrow(/already been registered/);
  });
});
