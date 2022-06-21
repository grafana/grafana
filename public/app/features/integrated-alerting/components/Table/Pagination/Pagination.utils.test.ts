import { getShownPages, getLeftItemNumber, getRightItemNumber } from './Pagination.utils';

describe('Pagination::utils', () => {
  test('getShownPages', () => {
    expect(getShownPages([0, 1, 2, 3], 1, 3)).toEqual([0, 1, 2]);
    expect(getShownPages([0, 1, 2, 3], 3, 3)).toEqual([1, 2, 3]);
    expect(getShownPages([0, 1, 2, 3], 3, 4)).toEqual([0, 1, 2, 3]);
    expect(getShownPages([0, 1, 2, 3], 0, 4)).toEqual([0, 1, 2, 3]);
    expect(getShownPages([0, 1, 2], 0, 0)).toEqual([]);
    expect(getShownPages([], 5, 2)).toEqual([]);
    expect(getShownPages([0, 1, 2], 3, 1)).toEqual([2]);
    expect(getShownPages([0, 1, 2], 3, 0)).toEqual([]);
  });

  test('getLeftItemNumber', () => {
    expect(getLeftItemNumber(5, 1, 2)).toBe(3);
    expect(getLeftItemNumber(5, 5, 2)).toBe(9);
    expect(getLeftItemNumber(3, 2, 3)).toBe(7);
    expect(getLeftItemNumber(0, 2, 3)).toBe(0);
  });

  test('getRightItemNumber', () => {
    expect(getRightItemNumber(1, 3, 3)).toBe(6);
    expect(getRightItemNumber(1, 3, 2)).toBe(5);
    expect(getRightItemNumber(0, 3, 1)).toBe(1);
    expect(getRightItemNumber(1, 3, 0)).toBe(3);
    expect(getRightItemNumber(2, 3, 0)).toBe(6);
    expect(getRightItemNumber(3, 4, 0)).toBe(12);
  });
});
