import { renderHook } from '@testing-library/react';

import { useDefaultDataSourceInstanceListItem as stableUseDefaultDataSourceInstanceListItem } from '@grafana/runtime';
import { useDefaultDataSourceInstanceListItem as unstableUseDefaultDataSourceInstanceListItem } from '@grafana/runtime/unstable';

import { getMockedListItem } from '../utils/mocks';

import { useDefaultDataSourceInstanceListItem } from './useDefaultDataSourceInstanceListItem';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useDefaultDataSourceInstanceListItem: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  useDefaultDataSourceInstanceListItem: jest.fn(),
}));

const mockStableUseDefaultDataSourceInstanceListItem = jest.mocked(stableUseDefaultDataSourceInstanceListItem);
const mockUnstableUseDefaultDataSourceInstanceListItem = jest.mocked(unstableUseDefaultDataSourceInstanceListItem);

const alpha = getMockedListItem({ uid: 'ds-a', name: 'A' });
const bravo = getMockedListItem({ uid: 'ds-b', name: 'B' });

describe('useDefaultDataSourceInstanceListItem', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should prefer the stable host hook over the unstable one', () => {
    mockStableUseDefaultDataSourceInstanceListItem.mockReturnValue({ isLoading: false, item: bravo });

    const { result } = renderHook(() => useDefaultDataSourceInstanceListItem([alpha, bravo]));

    expect(mockStableUseDefaultDataSourceInstanceListItem).toHaveBeenCalledWith([alpha, bravo]);
    expect(mockUnstableUseDefaultDataSourceInstanceListItem).not.toHaveBeenCalled();
    expect(result.current).toEqual({ isLoading: false, item: bravo });
  });
});
