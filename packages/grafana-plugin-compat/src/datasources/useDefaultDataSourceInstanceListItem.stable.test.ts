import { renderHook } from '@testing-library/react';

import { useDefaultDataSourceInstanceListItem as stableUseDefaultDataSourceInstanceListItem } from '@grafana/runtime';

import { getMockedListItem } from '../utils/mocks';

import { useDefaultDataSourceInstanceListItem } from './useDefaultDataSourceInstanceListItem';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useDefaultDataSourceInstanceListItem: jest.fn(),
}));

const mockStableUseDefaultDataSourceInstanceListItem = jest.mocked(stableUseDefaultDataSourceInstanceListItem);

const alpha = getMockedListItem({ uid: 'ds-a', name: 'A' });
const bravo = getMockedListItem({ uid: 'ds-b', name: 'B' });

describe('useDefaultDataSourceInstanceListItem', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should use the stable host hook', () => {
    mockStableUseDefaultDataSourceInstanceListItem.mockReturnValue({ isLoading: false, item: bravo });

    const { result } = renderHook(() => useDefaultDataSourceInstanceListItem([alpha, bravo]));

    expect(mockStableUseDefaultDataSourceInstanceListItem).toHaveBeenCalledWith([alpha, bravo]);
    expect(result.current).toEqual({ isLoading: false, item: bravo });
  });
});
