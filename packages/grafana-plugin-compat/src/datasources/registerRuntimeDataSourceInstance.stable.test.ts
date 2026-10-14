import { type DataSourceInstanceSettings } from '@grafana/data';
import {
  type RuntimeDataSource,
  registerRuntimeDataSourceInstance as stableRegisterRuntimeDataSourceInstance,
} from '@grafana/runtime';
import { registerRuntimeDataSourceInstance as unstableRegisterRuntimeDataSourceInstance } from '@grafana/runtime/unstable';

import { registerRuntimeDataSourceInstance } from './registerRuntimeDataSourceInstance';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  registerRuntimeDataSourceInstance: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  registerRuntimeDataSourceInstance: jest.fn(),
}));

const mockStableRegisterRuntimeDataSourceInstance = jest.mocked(stableRegisterRuntimeDataSourceInstance);
const mockUnstableRegisterRuntimeDataSourceInstance = jest.mocked(unstableRegisterRuntimeDataSourceInstance);
const mockDataSource = {
  uid: 'runtime-ds',
  instanceSettings: { uid: 'runtime-ds' } as DataSourceInstanceSettings,
} as RuntimeDataSource;

describe('registerRuntimeDataSourceInstance', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should prefer the stable export over the unstable one', () => {
    registerRuntimeDataSourceInstance({ dataSource: mockDataSource });

    expect(mockStableRegisterRuntimeDataSourceInstance).toHaveBeenCalledWith({ dataSource: mockDataSource });
    expect(mockUnstableRegisterRuntimeDataSourceInstance).not.toHaveBeenCalled();
  });
});
