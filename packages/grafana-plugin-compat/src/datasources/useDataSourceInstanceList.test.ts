import { renderHook } from '@testing-library/react';

import { useDataSourceInstanceList as rtUseDataSourceInstanceList } from '@grafana/runtime/unstable';

import { getMockedListItem } from '../utils/mocks';

import { useDataSourceInstanceList } from './useDataSourceInstanceList';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  useDataSourceInstanceList: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useDataSourceInstanceList: undefined,
}));

const mockRuntimeUseDataSourceInstanceList = jest.mocked(rtUseDataSourceInstanceList);
const mockItem = getMockedListItem({ uid: 'ds-logs', name: 'Loki' });

describe('useDataSourceInstanceList', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return the host hook result when the host provides the hook', () => {
    mockRuntimeUseDataSourceInstanceList.mockReturnValue({ isLoading: false, items: [mockItem] });

    const { result } = renderHook(() => useDataSourceInstanceList({ pluginId: 'loki' }));

    expect(mockRuntimeUseDataSourceInstanceList).toHaveBeenCalledWith({ pluginId: 'loki' });
    expect(result.current).toEqual({ isLoading: false, items: [mockItem] });
  });
});
