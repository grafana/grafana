import { type DataSourceInstanceSettings } from '@grafana/data';
import {
  type RuntimeDataSource,
  registerRuntimeDataSourceInstance as stableRegisterRuntimeDataSourceInstance,
} from '@grafana/runtime';

import { registerRuntimeDataSourceInstance } from './registerRuntimeDataSourceInstance';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  registerRuntimeDataSourceInstance: jest.fn(),
}));

const mockStableRegisterRuntimeDataSourceInstance = jest.mocked(stableRegisterRuntimeDataSourceInstance);
const mockDataSource = {
  uid: 'runtime-ds',
  instanceSettings: { uid: 'runtime-ds' } as DataSourceInstanceSettings,
} as RuntimeDataSource;

describe('registerRuntimeDataSourceInstance', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should call the stable export', () => {
    registerRuntimeDataSourceInstance({ dataSource: mockDataSource });

    expect(mockStableRegisterRuntimeDataSourceInstance).toHaveBeenCalledWith({ dataSource: mockDataSource });
  });

  it('should throw when the stable export throws', () => {
    mockStableRegisterRuntimeDataSourceInstance.mockImplementation(() => {
      throw new Error('A runtime data source with uid runtime-ds has already been registered');
    });

    expect(() => registerRuntimeDataSourceInstance({ dataSource: mockDataSource })).toThrow(/already been registered/);
  });
});
