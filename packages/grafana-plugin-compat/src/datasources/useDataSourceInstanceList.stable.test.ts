import { renderHook } from '@testing-library/react';

import { useDataSourceInstanceList as stableUseDataSourceInstanceList } from '@grafana/runtime';

import { getMockedListItem } from '../utils/mocks';

import { useDataSourceInstanceList } from './useDataSourceInstanceList';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useDataSourceInstanceList: jest.fn(),
}));

const mockStableUseDataSourceInstanceList = jest.mocked(stableUseDataSourceInstanceList);
const mockItem = getMockedListItem({ uid: 'ds-logs', name: 'Loki' });

describe('useDataSourceInstanceList', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should use the stable host hook', () => {
    mockStableUseDataSourceInstanceList.mockReturnValue({ isLoading: false, items: [mockItem] });

    const { result } = renderHook(() => useDataSourceInstanceList({ pluginId: 'loki' }));

    expect(mockStableUseDataSourceInstanceList).toHaveBeenCalledWith({ pluginId: 'loki' });
    expect(result.current).toEqual({ isLoading: false, items: [mockItem] });
  });
});
