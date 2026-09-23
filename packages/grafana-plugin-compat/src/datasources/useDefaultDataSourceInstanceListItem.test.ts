import { act, renderHook, waitFor } from '@testing-library/react';

import { getMockedListItem } from '../utils/mocks';

import { getDefaultDataSourceInstanceListItem } from './getDefaultDataSourceInstanceListItem';
import { useDefaultDataSourceInstanceListItem } from './useDefaultDataSourceInstanceListItem';

jest.mock('./getDefaultDataSourceInstanceListItem', () => ({
  getDefaultDataSourceInstanceListItem: jest.fn(),
}));

const mockGetDefaultDataSourceInstanceListItem = jest.mocked(getDefaultDataSourceInstanceListItem);

const alpha = getMockedListItem({ uid: 'ds-a', name: 'A' });
const bravo = getMockedListItem({ uid: 'ds-b', name: 'B', isDefault: true });

describe('useDefaultDataSourceInstanceListItem', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockGetDefaultDataSourceInstanceListItem.mockResolvedValue(bravo);
  });

  it('should resolve through the compat function, not the host', async () => {
    const { result } = renderHook(() => useDefaultDataSourceInstanceListItem([alpha, bravo]));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockGetDefaultDataSourceInstanceListItem).toHaveBeenCalledWith([alpha, bravo]);
    expect(result.current.item?.uid).toBe('ds-b');
    expect(result.current.error).toBeUndefined();
  });

  it('should resolve to undefined when the compat function finds no default', async () => {
    mockGetDefaultDataSourceInstanceListItem.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDefaultDataSourceInstanceListItem([alpha]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.item).toBeUndefined();
  });

  it('should expose a rejection as an error', async () => {
    mockGetDefaultDataSourceInstanceListItem.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useDefaultDataSourceInstanceListItem([alpha]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error?.message).toBe('boom');
    expect(result.current.item).toBeUndefined();
  });

  it('should not re-resolve when an equivalent inline array is re-rendered', async () => {
    const { result, rerender } = renderHook(() => useDefaultDataSourceInstanceListItem([{ ...alpha }, { ...bravo }]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockGetDefaultDataSourceInstanceListItem).toHaveBeenCalledTimes(1);

    rerender();
    await act(async () => {});

    expect(mockGetDefaultDataSourceInstanceListItem).toHaveBeenCalledTimes(1);
  });

  it('should re-resolve when the flag moves to another item', async () => {
    const { result, rerender } = renderHook(({ items }) => useDefaultDataSourceInstanceListItem(items), {
      initialProps: { items: [alpha, bravo] },
    });

    await waitFor(() => expect(result.current.item?.uid).toBe('ds-b'));

    mockGetDefaultDataSourceInstanceListItem.mockResolvedValue(alpha);
    rerender({
      items: [
        { ...alpha, isDefault: true },
        { ...bravo, isDefault: false },
      ],
    });

    await waitFor(() => expect(result.current.item?.uid).toBe('ds-a'));
    expect(mockGetDefaultDataSourceInstanceListItem).toHaveBeenCalledTimes(2);
  });
});
