import { act, renderHook } from '@testing-library/react';

import { usePagination } from './usePagination';

describe('usePagination()', () => {
  it('should work with no items', () => {
    const { result } = renderHook(() => {
      return usePagination([], 1, 20);
    });

    const { pageItems, numberOfPages, page, pageStart, pageEnd } = result.current;

    expect(pageItems).toStrictEqual([]);
    expect(numberOfPages).toStrictEqual(0);
    expect(page).toStrictEqual(1);
    expect(pageStart).toStrictEqual(1);
    expect(pageEnd).toStrictEqual(0);
  });

  it('should work with items < page size', () => {
    const { result } = renderHook(() => {
      return usePagination([1, 2, 3], 1, 10);
    });

    const { pageItems, numberOfPages, page, pageStart, pageEnd } = result.current;

    expect(pageItems).toStrictEqual([1, 2, 3]);
    expect(numberOfPages).toStrictEqual(1);
    expect(page).toStrictEqual(1);
    expect(pageStart).toStrictEqual(1);
    expect(pageEnd).toStrictEqual(3);
  });

  it('should work with items > page size', () => {
    const { result } = renderHook(() => {
      return usePagination([1, 2, 3], 1, 1);
    });

    const { pageItems, numberOfPages, page, pageStart, pageEnd } = result.current;

    expect(pageItems).toStrictEqual([1]);
    expect(numberOfPages).toStrictEqual(3);
    expect(page).toStrictEqual(1);
    expect(pageStart).toStrictEqual(1);
    expect(pageEnd).toStrictEqual(1);
  });

  it('should clamp pages', () => {
    const { result } = renderHook(() => {
      return usePagination([1, 2, 3], 1, 1);
    });

    expect(result.current.pageItems).toStrictEqual([1]);

    act(() => result.current.previousPage());
    expect(result.current.pageItems).toStrictEqual([1]);

    act(() => result.current.nextPage());
    expect(result.current.pageItems).toStrictEqual([2]);

    act(() => result.current.nextPage());
    expect(result.current.pageItems).toStrictEqual([3]);

    act(() => result.current.nextPage());
    expect(result.current.pageItems).toStrictEqual([3]);
  });
});
