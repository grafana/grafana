import { renderHook } from '@testing-library/react';

import { type DataSourceApi } from '@grafana/data';
import { useDataSourceInstance as stableUseDataSourceInstance } from '@grafana/runtime';

import { useDataSourceInstance } from './useDataSourceInstance';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useDataSourceInstance: jest.fn(),
}));

const mockStableUseDataSourceInstance = jest.mocked(stableUseDataSourceInstance);
const mockData = { uid: 'ds-logs', type: 'loki', name: 'Loki' } as DataSourceApi;

describe('useDataSourceInstance', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should use the stable host hook', () => {
    mockStableUseDataSourceInstance.mockReturnValue({ isLoading: false, dataSource: mockData });

    const { result } = renderHook(() => useDataSourceInstance('ds-logs'));

    expect(mockStableUseDataSourceInstance).toHaveBeenCalledWith('ds-logs');
    expect(result.current).toEqual({ isLoading: false, dataSource: mockData });
  });
});
