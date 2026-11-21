import {
  type PositionParams,
  calcGridItemPosition,
  calcWH,
  calcXY,
  clamp,
} from 'react-grid-layout/build/calculateUtils';
import {
  type Layout,
  bottom as layoutBottom,
  collides as itemsCollide,
  compact as compactLayout,
  correctBounds,
  getLayoutItem,
  moveElement,
  resizeItemInDirection,
} from 'react-grid-layout/build/utils';

import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT } from 'app/core/constants';

export interface GridLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const COLS = GRID_COLUMN_COUNT;
const ROW_HEIGHT = GRID_CELL_HEIGHT;
const MARGIN = GRID_CELL_VMARGIN;

// The react-grid-layout configuration dashboards render with today
function positionParams(containerWidth: number): PositionParams {
  return {
    cols: COLS,
    rowHeight: ROW_HEIGHT,
    margin: [MARGIN, MARGIN],
    containerPadding: [0, 0],
    containerWidth,
    maxRows: Infinity,
  };
}

// react-grid-layout moves the items it is given, so it only ever sees fresh copies. Copying just the
// geometry also drops any moved or static flags a caller's objects might carry.
function toLayout(layout: readonly GridLayoutItem[]): Layout {
  return layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
}

function fromLayout(layout: Layout): GridLayoutItem[] {
  return layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
}

function compactVertically(layout: Layout): Layout {
  return compactLayout(layout, 'vertical', COLS);
}

export function collides(a: GridLayoutItem, b: GridLayoutItem): boolean {
  return itemsCollide(a, b);
}

export function bottom(layout: readonly GridLayoutItem[]): number {
  return layoutBottom(layout);
}

/** Vertical compaction: every item moves up as far as it can, overlapping items are pushed down. */
export function compact(layout: readonly GridLayoutItem[]): GridLayoutItem[] {
  return fromLayout(compactVertically(toLayout(layout)));
}

/**
 * What react-grid-layout does to a layout it is given: pulls items that stick out of the grid back in
 * (an item with a negative x becomes full width), then compacts.
 */
export function normalizeLayout(layout: readonly GridLayoutItem[]): GridLayoutItem[] {
  return fromLayout(compactVertically(correctBounds(toLayout(layout), { cols: COLS })));
}

/**
 * One step of dragging an item to a cell. During a drag, pass the previous preview rather than the
 * layout from before the drag, since that is how react-grid-layout accumulates moves.
 */
export function previewMove(layout: readonly GridLayoutItem[], key: string, x: number, y: number): GridLayoutItem[] {
  const working = toLayout(layout);
  const item = getLayoutItem(working, key);
  if (!item) {
    return fromLayout(working);
  }
  // A user move: items hit directly by the dragged item may swap with it instead of being pushed down
  const moved = moveElement(working, item, clamp(x, 0, COLS - item.w), Math.max(y, 0), true, false, 'vertical', COLS);
  return fromLayout(compactVertically(moved));
}

/** Previews an item from outside this grid as if it were dragged in from below the last row. */
export function previewInsert(
  layout: readonly GridLayoutItem[],
  item: GridLayoutItem,
  x: number,
  y: number
): GridLayoutItem[] {
  const others = layout.filter((candidate) => candidate.i !== item.i);
  return previewMove([...others, { ...item, x: 0, y: bottom(others) }], item.i, x, y);
}

/** Layout with the item taken out and the gap closed. */
export function previewRemove(layout: readonly GridLayoutItem[], key: string): GridLayoutItem[] {
  return normalizeLayout(layout.filter((item) => item.i !== key));
}

/**
 * One step of resizing an item from its bottom-right corner. Items it now overlaps are pushed down.
 * Like previewMove, pass the previous preview during a resize. react-grid-layout compacts once more when
 * the resize ends, which can still move items in layouts with zero or negative sizes; run compact() on the
 * last preview to match it exactly.
 */
export function previewResize(layout: readonly GridLayoutItem[], key: string, w: number, h: number): GridLayoutItem[] {
  const working = toLayout(layout);
  const item = getLayoutItem(working, key);
  if (!item) {
    return fromLayout(working);
  }
  // Resizing from the bottom-right corner never moves the item, so compacting resolves every overlap
  item.w = Math.max(clamp(w, 0, COLS - item.x), 1);
  item.h = Math.max(h, 1);
  return fromLayout(compactVertically(working));
}

/**
 * Cell for an item of size w x h whose top-left corner is at the given pixel offset from the grid's
 * top-left corner. The margin is subtracted before rounding, so a cell is entered once the item is
 * just over half a column (or row) plus one margin past the previous cell.
 */
export function cellFromPixels(
  containerWidth: number,
  left: number,
  top: number,
  w: number,
  h: number
): { x: number; y: number } {
  return calcXY(positionParams(containerWidth), top, left, w, h);
}

/**
 * Grid size for an item being resized from its bottom-right corner to the given pixel size. Like
 * react-grid-layout, a width that would reach past the right edge of the grid keeps the current width.
 */
export function sizeFromPixels(
  containerWidth: number,
  item: Pick<GridLayoutItem, 'x' | 'y' | 'w' | 'h'>,
  size: { width: number; height: number }
): { w: number; h: number } {
  const params = positionParams(containerWidth);
  const current = calcGridItemPosition(params, item.x, item.y, item.w, item.h);
  const constrained = resizeItemInDirection('se', current, size, containerWidth);
  const { w, h } = calcWH(params, constrained.width, constrained.height, item.x, item.y, 'se');
  // Items have the default minimum size of one cell
  return { w: Math.max(w, 1), h: Math.max(h, 1) };
}

export function pixelRectFor(containerWidth: number, item: Pick<GridLayoutItem, 'x' | 'y' | 'w' | 'h'>): PixelRect {
  return calcGridItemPosition(positionParams(containerWidth), item.x, item.y, item.w, item.h);
}

/** react-grid-layout gives an empty grid a height of -8px, which browsers ignore; this returns 0 instead. */
export function containerHeightPx(layout: readonly GridLayoutItem[]): number {
  const rows = bottom(layout);
  return rows > 0 ? rows * ROW_HEIGHT + (rows - 1) * MARGIN : 0;
}

/**
 * Approximates the custom grid size of a panel from how it was rendered in an auto grid. Width is the
 * share of the auto grid row the panel occupied (so a 3 column auto grid gives 8, independent of how
 * wide the destination grid is). Height is converted from pixels, since custom grid rows have a fixed
 * pixel height.
 */
export function autoGridItemSizeToGridSize(
  itemRect: { width: number; height: number },
  autoGrid: { width: number; columnGap: number }
): { w: number; h: number } {
  const share = (itemRect.width + autoGrid.columnGap) / (autoGrid.width + autoGrid.columnGap);
  return {
    w: clamp(Math.round(COLS * share), 1, COLS),
    h: Math.max(1, Math.round((itemRect.height + MARGIN) / (ROW_HEIGHT + MARGIN))),
  };
}

export function isSameLayout(a: readonly GridLayoutItem[], b: readonly GridLayoutItem[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const byKey = new Map(b.map((item) => [item.i, item]));
  return a.every((item) => {
    const other = byKey.get(item.i);
    return other !== undefined && other.x === item.x && other.y === item.y && other.w === item.w && other.h === item.h;
  });
}
