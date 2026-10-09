import { renderHook } from '@testing-library/react';

import { useDefaultDataSourceInstanceListItem as rtUseDefaultDataSourceInstanceListItem } from '@grafana/runtime/unstable';

import { getMockedListItem } from '../utils/mocks';

import { useDefaultDataSourceInstanceListItem } from './useDefaultDataSourceInstanceListItem';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  useDefaultDataSourceInstanceListItem: jest.fn(),
}));

const mockRuntimeUseDefaultDataSourceInstanceListItem = jest.mocked(rtUseDefaultDataSourceInstanceListItem);

const alpha = getMockedListItem({ uid: 'ds-a', name: 'A' });
const bravo = getMockedListItem({ uid: 'ds-b', name: 'B' });

describe('useDefaultDataSourceInstanceListItem', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return the host hook result when the host provides the hook', () => {
    mockRuntimeUseDefaultDataSourceInstanceListItem.mockReturnValue({ isLoading: false, item: bravo });

    const { result } = renderHook(() => useDefaultDataSourceInstanceListItem([alpha, bravo]));

    expect(mockRuntimeUseDefaultDataSourceInstanceListItem).toHaveBeenCalledWith([alpha, bravo]);
    expect(result.current).toEqual({ isLoading: false, item: bravo });
  });
});
