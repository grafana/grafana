import { renderHook } from '@testing-library/react';

import { type DataSourceApi } from '@grafana/data';
import { useDataSourceInstance as rtUseDataSourceInstance } from '@grafana/runtime/unstable';

import { useDataSourceInstance } from './useDataSourceInstance';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  useDataSourceInstance: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useDataSourceInstance: undefined,
}));

const mockRuntimeUseDataSourceInstance = jest.mocked(rtUseDataSourceInstance);
const mockData = { uid: 'ds-logs', type: 'loki', name: 'Loki' } as DataSourceApi;

describe('useDataSourceInstance', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return the host hook result when the host provides the hook', () => {
    mockRuntimeUseDataSourceInstance.mockReturnValue({ isLoading: false, dataSource: mockData });

    const { result } = renderHook(() => useDataSourceInstance('ds-logs'));

    expect(mockRuntimeUseDataSourceInstance).toHaveBeenCalledWith('ds-logs');
    expect(result.current).toEqual({ isLoading: false, dataSource: mockData });
  });
});
