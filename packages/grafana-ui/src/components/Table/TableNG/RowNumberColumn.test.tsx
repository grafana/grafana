import { getDisplayedRowNumber } from './RowNumberColumn';

describe('getDisplayedRowNumber', () => {
  it.each([
    [1, 0, 1],
    [1, 2, 3],
    [26, 0, 26],
    [26, 3, 29],
    [100, 0, 100],
  ])('converts page start %i and page row index %i to position %i', (start, rowIdx, result) => {
    expect(getDisplayedRowNumber(start, rowIdx)).toBe(result);
  });
});
