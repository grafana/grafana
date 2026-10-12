import { shouldReserveScrollbarGutter } from './scrollbar';
import { type TableRow } from './types';

describe('shouldReserveScrollbarGutter', () => {
  const rows: TableRow[] = [
    { __index: 0, __depth: 0 },
    { __index: 1, __depth: 0 },
  ];

  it.each([
    { availableHeight: 100, expected: false },
    { availableHeight: 68, expected: false },
    { availableHeight: 67.5, expected: true },
  ])('returns $expected for two 34px rows in $availableHeight pixels', ({ availableHeight, expected }) => {
    expect(shouldReserveScrollbarGutter(rows, 34, [200, 200], 400, availableHeight)).toBe(expected);
  });

  it('releases the gutter when panel height grows and reserves it again when it shrinks', () => {
    expect([60, 100, 60].map((height) => shouldReserveScrollbarGutter(rows, 34, [200, 200], 400, height))).toEqual([
      true,
      false,
      true,
    ]);
  });

  it('uses the full-width wrapped row heights', () => {
    const height = (row: TableRow) => (row.__index === 0 ? 68 : 34);
    expect(shouldReserveScrollbarGutter(rows, height, [200, 200], 400, 102)).toBe(false);
    expect(shouldReserveScrollbarGutter(rows, height, [200, 200], 400, 101)).toBe(true);
  });

  it('retains the conservative gutter when horizontal scrollbars can consume height', () => {
    expect(shouldReserveScrollbarGutter(rows, 34, [300, 300], 400, 100)).toBe(true);
  });

  it('retains the conservative gutter for browser-sized rows', () => {
    expect(shouldReserveScrollbarGutter(rows, 'auto', [200, 200], 400, 100)).toBe(true);
  });

  it('does not reserve a gutter for an empty body with room for its chrome', () => {
    expect(shouldReserveScrollbarGutter([], 34, [200, 200], 400, 0)).toBe(false);
    expect(shouldReserveScrollbarGutter([], 34, [200, 200], 400, -1)).toBe(true);
  });
});
