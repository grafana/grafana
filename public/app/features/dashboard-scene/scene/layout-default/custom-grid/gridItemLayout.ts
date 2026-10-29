import { type SceneGridItemLike, type SceneGridLayout, SceneGridRow, VizPanel } from '@grafana/scenes';

import { type GridLayoutItem } from './gridMath';

/** The size scenes gives a grid item without a finite width or height */
export const SCENES_DEFAULT_PANEL_SPAN = 4;

/**
 * Layout items are keyed by panel key, since a panel keeps its key when it is moved between layouts
 * and gets a new grid item. Falls back to the grid item's key for bodies that are not panels.
 */
export function getLayoutKey(gridItem: SceneGridItemLike): string {
  const body = 'body' in gridItem.state ? gridItem.state.body : undefined;
  if (body instanceof VizPanel && body.state.key) {
    return body.state.key;
  }
  return gridItem.state.key ?? '';
}

/** Grids with rows are left to the old renderer, the custom grid only lays out panels. */
export function hasGridRows(grid: SceneGridLayout): boolean {
  return grid.state.children.some((child) => child instanceof SceneGridRow);
}

/**
 * The cells scenes hands react-grid-layout for these grid items, in the same order: values that are
 * not finite get the scenes defaults, and items are sorted by position since compaction breaks ties
 * between items at the same position by order.
 */
export function gridItemsToLayout(children: readonly SceneGridItemLike[]): GridLayoutItem[] {
  return children
    .map((child) => {
      const { x, y, width, height } = child.state;
      return {
        i: getLayoutKey(child),
        x: finiteOr(x, 0),
        y: finiteOr(y, 0),
        w: finiteOr(width, SCENES_DEFAULT_PANEL_SPAN),
        h: finiteOr(height, SCENES_DEFAULT_PANEL_SPAN),
      };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

// Number() rather than a type check, because scenes treats null as 0
function finiteOr(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
