import { getDisplayedRowNumber, getRowNumberGutterWidth } from './RowNumberColumn';
import { FIRST_COLUMN_EXTRA_PADDING } from './constants';

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

describe('getRowNumberGutterWidth', () => {
  it('measures the maximum position using monospace character metrics at digit boundaries', () => {
    expect(getRowNumberGutterWidth(0, 8)).toBe(32);
    expect(getRowNumberGutterWidth(9, 8)).toBe(32);
    expect(getRowNumberGutterWidth(99, 8)).toBe(33);
    expect(getRowNumberGutterWidth(100, 8)).toBe(41);
    expect(getRowNumberGutterWidth(1000, 8)).toBe(49);
  });

  it('reserves the panel-edge inset only when needed', () => {
    expect(getRowNumberGutterWidth(100, 8, true)).toBe(
      getRowNumberGutterWidth(100, 8, false) + FIRST_COLUMN_EXTRA_PADDING
    );
  });
});
