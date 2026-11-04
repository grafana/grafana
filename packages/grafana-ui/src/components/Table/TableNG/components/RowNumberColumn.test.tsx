import { FIRST_COLUMN_EXTRA_PADDING } from '../constants';
import { type TableRow } from '../types';

import { getDisplayedParentRowNumbers, getDisplayedRowNumber, getRowNumberGutterWidth } from './RowNumberColumn';

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
    expect(getRowNumberGutterWidth(0, 8, 32, 4)).toBe(32);
    expect(getRowNumberGutterWidth(9, 8, 32, 4)).toBe(32);
    expect(getRowNumberGutterWidth(99, 8, 32, 4)).toBe(33);
    expect(getRowNumberGutterWidth(100, 8, 32, 4)).toBe(41);
    expect(getRowNumberGutterWidth(1000, 8, 32, 4)).toBe(49);
  });

  it('reserves the panel-edge inset only when needed', () => {
    expect(getRowNumberGutterWidth(100, 8, 32, 4, true)).toBe(
      getRowNumberGutterWidth(100, 8, 32, 4, false) + FIRST_COLUMN_EXTRA_PADDING
    );
  });
});

describe('getDisplayedParentRowNumbers', () => {
  it('counts only parents in display order and continues from the page start', () => {
    const rows: TableRow[] = [
      { __index: 9, __depth: 0 },
      { __index: 9, __depth: 1 },
      { __index: 4, __depth: 0 },
      { __index: 4, __depth: 1 },
      { __index: 7, __depth: 0 },
    ];
    const positions = getDisplayedParentRowNumbers(rows, 26);
    expect([...positions.entries()]).toEqual([
      [9, 26],
      [4, 27],
      [7, 28],
    ]);
  });

  it('returns no positions for an empty or placeholder-only page', () => {
    expect(getDisplayedParentRowNumbers([]).size).toBe(0);
    expect(getDisplayedParentRowNumbers([{ __index: 1, __depth: 1 }]).size).toBe(0);
  });
});
