import { renderHook } from '@testing-library/react';

import { type DataSourceApi } from '@grafana/data';
import { useDataSourceInstance as stableUseDataSourceInstance } from '@grafana/runtime';
import { useDataSourceInstance as unstableUseDataSourceInstance } from '@grafana/runtime/unstable';

import { useDataSourceInstance } from './useDataSourceInstance';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useDataSourceInstance: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  useDataSourceInstance: jest.fn(),
}));

const mockStableUseDataSourceInstance = jest.mocked(stableUseDataSourceInstance);
const mockUnstableUseDataSourceInstance = jest.mocked(unstableUseDataSourceInstance);
const mockData = { uid: 'ds-logs', type: 'loki', name: 'Loki' } as DataSourceApi;

describe('useDataSourceInstance', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should prefer the stable host hook over the unstable one', () => {
    mockStableUseDataSourceInstance.mockReturnValue({ isLoading: false, dataSource: mockData });

    const { result } = renderHook(() => useDataSourceInstance('ds-logs'));

    expect(mockStableUseDataSourceInstance).toHaveBeenCalledWith('ds-logs');
    expect(mockUnstableUseDataSourceInstance).not.toHaveBeenCalled();
    expect(result.current).toEqual({ isLoading: false, dataSource: mockData });
  });
});
