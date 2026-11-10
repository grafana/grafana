import { renderHook } from '@testing-library/react';

import { useDataSourceInstanceListItem as stableUseDataSourceInstanceListItem } from '@grafana/runtime';

import { getMockedListItem } from '../utils/mocks';

import { useDataSourceInstanceListItem } from './useDataSourceInstanceListItem';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useDataSourceInstanceListItem: jest.fn(),
}));

const mockStableUseDataSourceInstanceListItem = jest.mocked(stableUseDataSourceInstanceListItem);
const mockItem = getMockedListItem({ uid: 'ds-logs', type: 'loki', name: 'Loki' });

describe('useDataSourceInstanceListItem', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should use the stable host hook', () => {
    mockStableUseDataSourceInstanceListItem.mockReturnValue({ isLoading: false, item: mockItem });

    const { result } = renderHook(() => useDataSourceInstanceListItem('ds-logs'));

    expect(mockStableUseDataSourceInstanceListItem).toHaveBeenCalledWith('ds-logs');
    expect(result.current).toEqual({ isLoading: false, item: mockItem });
  });
});
