import { type Layout } from 'react-grid-layout-v2/core';

import {
  autoGridItemSizeToGridSize,
  cellFromPixels,
  containerHeightPx,
  previewInsert,
  previewMove,
  previewRemove,
  previewResize,
} from './gridMath';

// Two panels side by side on the first row, one full width panel below them
const layout: Layout = [
  { i: 'a', x: 0, y: 0, w: 12, h: 8 },
  { i: 'b', x: 12, y: 0, w: 12, h: 8 },
  { i: 'c', x: 0, y: 8, w: 24, h: 4 },
];

const byKey = (l: Layout) => Object.fromEntries(l.map(({ i, x, y, w, h }) => [i, { x, y, w, h }]));

describe('gridMath', () => {
  it('previewRemove closes the gap left by the removed item', () => {
    // c is full width, so it can only move up once both panels above it are gone
    expect(byKey(previewRemove(layout, 'a')).c.y).toBe(8);
    expect(byKey(previewRemove(previewRemove(layout, 'a'), 'b'))).toEqual({
      c: { x: 0, y: 0, w: 24, h: 4 },
    });
  });

  it('previewInsert pushes colliding items down to make room at the hovered cell', () => {
    const result = byKey(previewInsert(layout, { i: 'new', x: 0, y: 0, w: 24, h: 2 }, 0, 0));

    expect(result.new).toEqual({ x: 0, y: 0, w: 24, h: 2 });
    expect(result.a.y).toBe(2);
    expect(result.b.y).toBe(2);
    expect(result.c.y).toBe(10);
  });

  it('previewInsert does not mutate the layout passed in', () => {
    const before = JSON.stringify(layout);
    previewInsert(layout, { i: 'new', x: 0, y: 0, w: 6, h: 6 }, 6, 0);
    expect(JSON.stringify(layout)).toBe(before);
  });

  it('previewMove moves an item to the hovered cell and compacts the rest', () => {
    const result = byKey(previewMove(layout, 'c', 0, 0));

    expect(result.c).toEqual({ x: 0, y: 0, w: 24, h: 4 });
    expect(result.a.y).toBe(4);
    expect(result.b.y).toBe(4);
  });

  it('previewResize pushes items below the resized item down', () => {
    const result = byKey(previewResize(layout, 'a', 12, 10));

    expect(result.a).toEqual({ x: 0, y: 0, w: 12, h: 10 });
    expect(result.c.y).toBe(10);
  });

  it('cellFromPixels snaps pixel positions to the nearest cell', () => {
    // 24 columns with 8px gaps in a 1016px wide grid gives 34px columns, a 42px column pitch
    expect(cellFromPixels(1016, 42 * 6 + 10, 38 * 3 + 5, 6, 6)).toEqual({ x: 6, y: 3 });
  });

  it('containerHeightPx accounts for row margins', () => {
    expect(containerHeightPx(layout)).toBe(12 * 30 + 11 * 8);
    expect(containerHeightPx([])).toBe(0);
  });

  describe('autoGridItemSizeToGridSize', () => {
    it('uses the share of the auto grid row the panel took up as its width', () => {
      // 3 columns with 8px gaps in a 1216px wide auto grid
      expect(autoGridItemSizeToGridSize({ width: 400, height: 320 }, { width: 1216, columnGap: 8 }).w).toBe(8);
      // 2 columns
      expect(autoGridItemSizeToGridSize({ width: 604, height: 320 }, { width: 1216, columnGap: 8 }).w).toBe(12);
      // single column
      expect(autoGridItemSizeToGridSize({ width: 1216, height: 320 }, { width: 1216, columnGap: 8 }).w).toBe(24);
    });

    it('converts the rendered height to custom grid rows', () => {
      // 8 rows are 8 * 30 + 7 * 8 = 296px
      expect(autoGridItemSizeToGridSize({ width: 400, height: 296 }, { width: 1216, columnGap: 8 }).h).toBe(8);
      // The default 320px auto grid row height lands between 8 and 9 rows
      expect(autoGridItemSizeToGridSize({ width: 400, height: 320 }, { width: 1216, columnGap: 8 }).h).toBe(9);
    });
  });
});
