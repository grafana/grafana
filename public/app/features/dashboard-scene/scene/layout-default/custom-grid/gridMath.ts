import {
  calcGridItemPosition,
  calcWH,
  calcXY,
  cloneLayout,
  moveElement,
  type Layout,
  type LayoutItem,
  type PositionParams,
  verticalCompactor,
} from 'react-grid-layout-v2/core';

import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT } from 'app/core/constants';

export interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function getPositionParams(containerWidth: number): PositionParams {
  return {
    margin: [GRID_CELL_VMARGIN, GRID_CELL_VMARGIN],
    containerPadding: [0, 0],
    containerWidth,
    cols: GRID_COLUMN_COUNT,
    rowHeight: GRID_CELL_HEIGHT,
    maxRows: Infinity,
  };
}

export function compact(layout: Layout): LayoutItem[] {
  return [...verticalCompactor.compact(layout, GRID_COLUMN_COUNT)];
}

/**
 * Moves an item that is already part of the layout. Mirrors react-grid-layout's own drag handling:
 * the move is applied to the layout passed in (the previous preview during a drag, not the
 * committed layout), so results accumulate across pointer moves exactly like the legacy grid.
 */
export function previewMove(layout: Layout, key: string, x: number, y: number): LayoutItem[] {
  const next = cloneLayout(layout);
  const item = next.find((i) => i.i === key);
  if (!item) {
    return next;
  }
  return compact(moveElement(next, item, x, y, true, false, 'vertical', GRID_COLUMN_COUNT));
}

/**
 * Inserts an item that is not part of the layout yet (a panel dragged in from another layout).
 * Mirrors react-grid-layout's external drop: the item is placed at the cell and collisions are
 * pushed down before compacting.
 */
export function previewInsert(layout: Layout, item: LayoutItem, x: number, y: number): LayoutItem[] {
  const inserted = { ...item, x: 0, y: bottom(layout) };
  const next = [...cloneLayout(layout).filter((i) => i.i !== item.i), inserted];
  return compact(moveElement(next, inserted, x, y, true, false, 'vertical', GRID_COLUMN_COUNT));
}

/** Layout with the item taken out, gap closed. */
export function previewRemove(layout: Layout, key: string): LayoutItem[] {
  return compact(cloneLayout(layout).filter((i) => i.i !== key));
}

export function previewResize(layout: Layout, key: string, w: number, h: number): LayoutItem[] {
  const next = cloneLayout(layout);
  const item = next.find((i) => i.i === key);
  if (!item) {
    return next;
  }
  item.w = Math.max(1, Math.min(w, GRID_COLUMN_COUNT - item.x));
  item.h = Math.max(1, h);
  // Same as react-grid-layout's resize: compaction pushes overlapped items below the resized one down
  return compact(next);
}

/** Cell for an item whose top-left corner is at the given pixel position (relative to the grid). */
export function cellFromPixels(
  containerWidth: number,
  left: number,
  top: number,
  w: number,
  h: number
): { x: number; y: number } {
  return calcXY(getPositionParams(containerWidth), top, left, w, h);
}

export function sizeFromPixels(
  containerWidth: number,
  width: number,
  height: number,
  x: number,
  y: number
): { w: number; h: number } {
  return calcWH(getPositionParams(containerWidth), width, height, x, y, 'se');
}

export function pixelRectFor(containerWidth: number, item: Pick<LayoutItem, 'x' | 'y' | 'w' | 'h'>): PixelRect {
  return calcGridItemPosition(getPositionParams(containerWidth), item.x, item.y, item.w, item.h);
}

export function bottom(layout: Layout): number {
  let max = 0;
  for (const item of layout) {
    max = Math.max(max, item.y + item.h);
  }
  return max;
}

export function containerHeightPx(layout: Layout): number {
  const rows = bottom(layout);
  return rows > 0 ? rows * GRID_CELL_HEIGHT + (rows - 1) * GRID_CELL_VMARGIN : 0;
}

/**
 * Approximates the custom grid size of a panel from how it was rendered in an auto grid.
 * Width is the share of the auto grid row the panel occupied (so a 3 column auto grid gives 8,
 * independent of how wide the destination grid is). Height is converted from pixels, since custom
 * grid rows have a fixed pixel height.
 */
export function autoGridItemSizeToGridSize(
  itemRect: { width: number; height: number },
  autoGrid: { width: number; columnGap: number }
): { w: number; h: number } {
  const share = (itemRect.width + autoGrid.columnGap) / (autoGrid.width + autoGrid.columnGap);
  const w = clamp(Math.round(GRID_COLUMN_COUNT * share), 1, GRID_COLUMN_COUNT);
  const h = Math.max(1, Math.round((itemRect.height + GRID_CELL_VMARGIN) / (GRID_CELL_HEIGHT + GRID_CELL_VMARGIN)));
  return { w, h };
}

export function isSameLayout(a: Layout, b: Layout): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const byKey = new Map(b.map((item) => [item.i, item]));
  return a.every((item) => {
    const other = byKey.get(item.i);
    return other && other.x === item.x && other.y === item.y && other.w === item.w && other.h === item.h;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
