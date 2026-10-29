import { logWarning } from '@grafana/runtime';
import { type SceneGridItemLike, SceneGridLayout } from '@grafana/scenes';
import { GRID_COLUMN_COUNT } from 'app/core/constants';

import { isUnifiedDragAndDropEnabled } from '../../layouts-shared/unifiedDragAndDrop';

import { hasGridRows, SCENES_DEFAULT_PANEL_SPAN } from './gridItemLayout';
import { collides, type GridLayoutItem, normalizeLayout } from './gridMath';

export interface LayoutValidation {
  isValid: boolean;
  /** Pairs of items that overlap */
  overlapCount: number;
  /** Items that reach past the last column */
  outOfBoundsCount: number;
  /** Items with a negative position, a size below one cell or a value that is not a finite number */
  invalidValueCount: number;
}

export type LayoutValidationContext = 'commit' | 'save';

export interface GridItemPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function validateLayout(layout: readonly GridLayoutItem[]): LayoutValidation {
  let overlapCount = 0;
  let outOfBoundsCount = 0;
  let invalidValueCount = 0;
  const comparable: GridLayoutItem[] = [];

  for (const item of layout) {
    if (!hasValidValues(item)) {
      invalidValueCount++;
      continue;
    }
    if (item.x + item.w > GRID_COLUMN_COUNT) {
      outOfBoundsCount++;
    }
    comparable.push(item);
  }

  for (let a = 0; a < comparable.length; a++) {
    for (let b = a + 1; b < comparable.length; b++) {
      if (collides(comparable[a], comparable[b])) {
        overlapCount++;
      }
    }
  }

  return {
    isValid: overlapCount === 0 && outOfBoundsCount === 0 && invalidValueCount === 0,
    overlapCount,
    outOfBoundsCount,
    invalidValueCount,
  };
}

/**
 * Turns any layout into a valid one: values that are not usable get the defaults scenes renders them
 * with, then the layout is normalized the way react-grid-layout does it (items sticking out of the
 * grid are pulled back in and overlaps are resolved by compacting).
 */
export function correctLayout(layout: readonly GridLayoutItem[]): GridLayoutItem[] {
  return normalizeLayout(
    layout.map(({ i, x, y, w, h }) => ({
      i,
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? Math.max(y, 0) : 0,
      w: Number.isFinite(w) ? Math.max(w, 1) : SCENES_DEFAULT_PANEL_SPAN,
      h: Number.isFinite(h) ? Math.max(h, 1) : SCENES_DEFAULT_PANEL_SPAN,
    }))
  );
}

/**
 * Returns the layout unchanged when it is valid. Otherwise reports what was wrong with it, as counts
 * only, and returns the corrected layout.
 */
export function ensureValidLayout(
  layout: readonly GridLayoutItem[],
  context: LayoutValidationContext
): readonly GridLayoutItem[] {
  const validation = validateLayout(layout);
  if (validation.isValid) {
    return layout;
  }

  logWarning('Corrected an invalid custom grid layout', {
    context,
    itemCount: String(layout.length),
    overlapCount: String(validation.overlapCount),
    outOfBoundsCount: String(validation.outOfBoundsCount),
    invalidValueCount: String(validation.invalidValueCount),
  });
  return correctLayout(layout);
}

interface SaveCorrection {
  children: readonly SceneGridItemLike[];
  signature: string;
  placements: Map<SceneGridItemLike, GridItemPlacement> | null;
}

// Serializers ask for one grid item at a time, so the result for the whole grid is kept until the
// grid's children or any of their positions change. This also reports each invalid layout only once.
const saveCorrections = new WeakMap<SceneGridLayout, SaveCorrection>();

/**
 * Where a grid item of a custom grid is saved when the grid's layout is invalid. Returns undefined when
 * the position should be read from the grid item as before: with the unified drag and drop flag off,
 * for valid layouts, for grids with rows and for items that are not in a grid.
 */
export function getCorrectedPlacementForSave(gridItem: SceneGridItemLike): GridItemPlacement | undefined {
  if (!isUnifiedDragAndDropEnabled()) {
    return undefined;
  }

  const grid = gridItem.parent;
  if (!(grid instanceof SceneGridLayout) || hasGridRows(grid)) {
    return undefined;
  }

  return getSaveCorrection(grid).placements?.get(gridItem);
}

function getSaveCorrection(grid: SceneGridLayout): SaveCorrection {
  const children = grid.state.children;
  const signature = children.map(({ state }) => `${state.x},${state.y},${state.width},${state.height}`).join(';');
  const cached = saveCorrections.get(grid);
  if (cached && cached.children === children && cached.signature === signature) {
    return cached;
  }

  // The values the serializers write, keyed by index so that duplicate keys cannot hide an item
  const layout = children.map(({ state }, index) => ({
    i: String(index),
    x: state.x ?? 0,
    y: state.y ?? 0,
    w: state.width ?? 0,
    h: state.height ?? 0,
  }));

  const valid = ensureValidLayout(layout, 'save');
  let placements: SaveCorrection['placements'] = null;
  if (valid !== layout) {
    const byIndex = new Map(valid.map((item) => [item.i, item]));
    placements = new Map(
      children.flatMap((child, index): Array<[SceneGridItemLike, GridItemPlacement]> => {
        const item = byIndex.get(String(index));
        return item ? [[child, { x: item.x, y: item.y, width: item.w, height: item.h }]] : [];
      })
    );
  }

  const correction = { children, signature, placements };
  saveCorrections.set(grid, correction);
  return correction;
}

function hasValidValues({ x, y, w, h }: GridLayoutItem): boolean {
  return [x, y, w, h].every(Number.isFinite) && x >= 0 && y >= 0 && w >= 1 && h >= 1;
}
