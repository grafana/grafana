import { renderHook } from '@testing-library/react';

import { useDataSourceInstanceList as stableUseDataSourceInstanceList } from '@grafana/runtime';
import { useDataSourceInstanceList as unstableUseDataSourceInstanceList } from '@grafana/runtime/unstable';

import { getMockedListItem } from '../utils/mocks';

import { useDataSourceInstanceList } from './useDataSourceInstanceList';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useDataSourceInstanceList: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  useDataSourceInstanceList: jest.fn(),
}));

const mockStableUseDataSourceInstanceList = jest.mocked(stableUseDataSourceInstanceList);
const mockUnstableUseDataSourceInstanceList = jest.mocked(unstableUseDataSourceInstanceList);
const mockItem = getMockedListItem({ uid: 'ds-logs', name: 'Loki' });

describe('useDataSourceInstanceList', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should prefer the stable host hook over the unstable one', () => {
    mockStableUseDataSourceInstanceList.mockReturnValue({ isLoading: false, items: [mockItem] });

    const { result } = renderHook(() => useDataSourceInstanceList({ pluginId: 'loki' }));

    expect(mockStableUseDataSourceInstanceList).toHaveBeenCalledWith({ pluginId: 'loki' });
    expect(mockUnstableUseDataSourceInstanceList).not.toHaveBeenCalled();
    expect(result.current).toEqual({ isLoading: false, items: [mockItem] });
  });
});
