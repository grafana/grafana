import {
  type GridLayoutItem,
  autoGridItemSizeToGridSize,
  cellFromPixels,
  containerHeightPx,
  isSameLayout,
  normalizeLayout,
  pixelRectFor,
  previewInsert,
  previewMove,
  previewRemove,
  previewResize,
  sizeFromPixels,
} from './gridMath';

const byKey = (layout: GridLayoutItem[]) => Object.fromEntries(layout.map(({ i, x, y, w, h }) => [i, { x, y, w, h }]));

// Two half width panels side by side, one full width panel below them
const layout: GridLayoutItem[] = [
  { i: 'a', x: 0, y: 0, w: 12, h: 8 },
  { i: 'b', x: 12, y: 0, w: 12, h: 8 },
  { i: 'c', x: 0, y: 8, w: 24, h: 4 },
];

// 24 columns of 34px with 8px gaps: a 42px column pitch, and a 38px row pitch
const WIDTH = 1000;

describe('previewMove', () => {
  const stacked: GridLayoutItem[] = [
    { i: 'top', x: 0, y: 0, w: 24, h: 4 },
    { i: 'bottom', x: 0, y: 4, w: 24, h: 4 },
  ];

  it('swaps a panel moved up onto the panel above it', () => {
    expect(byKey(previewMove(stacked, 'bottom', 0, 0))).toEqual({
      top: { x: 0, y: 4, w: 24, h: 4 },
      bottom: { x: 0, y: 0, w: 24, h: 4 },
    });
  });

  it('swaps a panel moved down by the height of the panel below it', () => {
    expect(byKey(previewMove(stacked, 'top', 0, 4))).toEqual({
      top: { x: 0, y: 4, w: 24, h: 4 },
      bottom: { x: 0, y: 0, w: 24, h: 4 },
    });
  });

  it('keeps the order when a panel is moved down by less than the panel below it is tall', () => {
    expect(byKey(previewMove(stacked, 'top', 0, 1))).toEqual({
      top: { x: 0, y: 0, w: 24, h: 4 },
      bottom: { x: 0, y: 4, w: 24, h: 4 },
    });
  });

  it('pushes every panel the moved panel lands on below it', () => {
    expect(byKey(previewMove(layout, 'c', 0, 0))).toEqual({
      a: { x: 0, y: 4, w: 12, h: 8 },
      b: { x: 12, y: 4, w: 12, h: 8 },
      c: { x: 0, y: 0, w: 24, h: 4 },
    });
  });

  it('leaves the other panels in place when dropping into an empty gap', () => {
    const withGap: GridLayoutItem[] = [
      { i: 'tall', x: 0, y: 0, w: 12, h: 8 },
      { i: 'short', x: 12, y: 0, w: 12, h: 4 },
      { i: 'moved', x: 0, y: 8, w: 12, h: 4 },
    ];
    expect(byKey(previewMove(withGap, 'moved', 12, 4))).toEqual({
      tall: { x: 0, y: 0, w: 12, h: 8 },
      short: { x: 12, y: 0, w: 12, h: 4 },
      moved: { x: 12, y: 4, w: 12, h: 4 },
    });
  });

  it('does not mutate the layout passed in', () => {
    const before = JSON.stringify(layout);
    previewMove(layout, 'c', 0, 0);
    expect(JSON.stringify(layout)).toBe(before);
  });
});

describe('previewResize', () => {
  it('pushes the panel below a growing panel down', () => {
    expect(byKey(previewResize(layout, 'a', 12, 10))).toEqual({
      a: { x: 0, y: 0, w: 12, h: 10 },
      b: { x: 12, y: 0, w: 12, h: 8 },
      c: { x: 0, y: 10, w: 24, h: 4 },
    });
  });

  it('pushes a neighbour on the same row below a panel that grows into it', () => {
    expect(byKey(previewResize(layout, 'a', 16, 8)).b).toEqual({ x: 12, y: 8, w: 12, h: 8 });
  });

  it('pulls the panel below back up when a panel shrinks', () => {
    const stacked: GridLayoutItem[] = [
      { i: 'top', x: 0, y: 0, w: 24, h: 4 },
      { i: 'bottom', x: 0, y: 4, w: 24, h: 4 },
    ];
    expect(byKey(previewResize(stacked, 'top', 24, 2)).bottom).toEqual({ x: 0, y: 2, w: 24, h: 4 });
  });
});

describe('previewInsert', () => {
  it('pushes the panels at the hovered cell down to make room', () => {
    expect(byKey(previewInsert(layout, { i: 'new', x: 0, y: 0, w: 24, h: 2 }, 0, 0))).toEqual({
      a: { x: 0, y: 2, w: 12, h: 8 },
      b: { x: 12, y: 2, w: 12, h: 8 },
      c: { x: 0, y: 10, w: 24, h: 4 },
      new: { x: 0, y: 0, w: 24, h: 2 },
    });
  });
});

describe('previewRemove', () => {
  it('moves the panel below up once nothing above it is left', () => {
    expect(byKey(previewRemove(layout, 'a')).c).toEqual({ x: 0, y: 8, w: 24, h: 4 });
    expect(byKey(previewRemove(previewRemove(layout, 'a'), 'b'))).toEqual({ c: { x: 0, y: 0, w: 24, h: 4 } });
  });
});

describe('normalizeLayout', () => {
  it.each([
    { name: 'closes gaps above panels', item: { x: 4, y: 10, w: 6, h: 3 }, expected: { x: 4, y: 0, w: 6, h: 3 } },
    {
      name: 'moves panels sticking out on the right back in',
      item: { x: 20, y: 0, w: 8, h: 3 },
      expected: { x: 16, y: 0, w: 8, h: 3 },
    },
    {
      name: 'makes panels wider than the grid full width',
      item: { x: 3, y: 0, w: 30, h: 3 },
      expected: { x: 0, y: 0, w: 24, h: 3 },
    },
    {
      name: 'makes panels with a negative x full width',
      item: { x: -2, y: 0, w: 6, h: 3 },
      expected: { x: 0, y: 0, w: 24, h: 3 },
    },
  ])('$name', ({ item, expected }) => {
    expect(normalizeLayout([{ i: 'p', ...item }])).toEqual([{ i: 'p', ...expected }]);
  });

  it('pushes the later of two overlapping panels below the earlier one', () => {
    const overlapping = [
      { i: 'first', x: 0, y: 0, w: 12, h: 4 },
      { i: 'second', x: 6, y: 2, w: 12, h: 4 },
    ];
    expect(byKey(normalizeLayout(overlapping)).second).toEqual({ x: 6, y: 4, w: 12, h: 4 });
  });
});

describe('cellFromPixels', () => {
  it.each([
    { left: 28, top: 0, expected: { x: 0, y: 0 } },
    { left: 29, top: 0, expected: { x: 1, y: 0 } },
    { left: 0, top: 26, expected: { x: 0, y: 0 } },
    { left: 0, top: 27, expected: { x: 0, y: 1 } },
  ])('rounds ($left, $top) to the nearest cell after subtracting one margin', ({ left, top, expected }) => {
    expect(cellFromPixels(WIDTH, left, top, 6, 6)).toEqual(expected);
  });

  it('keeps the item inside the grid when dragged past its edges', () => {
    expect(cellFromPixels(WIDTH, 2000, -500, 6, 6)).toEqual({ x: 18, y: 0 });
    expect(cellFromPixels(WIDTH, -500, 100, 6, 6)).toEqual({ x: 0, y: 2 });
  });
});

describe('sizeFromPixels', () => {
  const item = { x: 12, y: 0, w: 6, h: 4 };

  it('rounds the pixel size to whole cells', () => {
    expect(sizeFromPixels(WIDTH, item, { width: 400, height: 300 })).toEqual({ w: 10, h: 8 });
  });

  it('keeps the current width when the new width would reach past the right edge of the grid', () => {
    expect(sizeFromPixels(WIDTH, item, { width: 600, height: 300 })).toEqual({ w: 6, h: 8 });
  });

  it('never goes below one cell', () => {
    expect(sizeFromPixels(WIDTH, item, { width: 0, height: 0 })).toEqual({ w: 1, h: 1 });
  });
});

describe('pixelRectFor', () => {
  it('places an item on the column and row pitch, spanning the gaps between its cells', () => {
    expect(pixelRectFor(WIDTH, { x: 6, y: 2, w: 6, h: 4 })).toEqual({ left: 252, top: 76, width: 244, height: 144 });
  });
});

describe('containerHeightPx', () => {
  it('spans every row and the margins between them', () => {
    expect(containerHeightPx(layout)).toBe(448);
  });

  it('is 0 for an empty grid', () => {
    expect(containerHeightPx([])).toBe(0);
  });
});

describe('autoGridItemSizeToGridSize', () => {
  it.each([
    { columns: 3, width: 400, expected: 8 },
    { columns: 2, width: 604, expected: 12 },
    { columns: 1, width: 1216, expected: 24 },
  ])('gives a panel from a $columns column auto grid a width of $expected', ({ width, expected }) => {
    expect(autoGridItemSizeToGridSize({ width, height: 320 }, { width: 1216, columnGap: 8 }).w).toBe(expected);
  });

  it('converts the height in pixels to rows', () => {
    expect(autoGridItemSizeToGridSize({ width: 400, height: 320 }, { width: 1216, columnGap: 8 }).h).toBe(9);
  });
});

describe('isSameLayout', () => {
  it('ignores the order of the items', () => {
    expect(isSameLayout(layout, [...layout].reverse())).toBe(true);
  });

  it('detects a moved item', () => {
    expect(isSameLayout(layout, previewMove(layout, 'c', 0, 0))).toBe(false);
  });
});
