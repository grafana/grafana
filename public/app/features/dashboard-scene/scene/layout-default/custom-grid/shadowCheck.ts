import { type Unsubscribable } from 'rxjs';

import { logDebug, logMeasurement } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { type SceneGridItemLike, type SceneGridLayout, SceneGridRow } from '@grafana/scenes';

import { type GridLayoutItem, normalizeLayout } from './gridMath';

export const GRID_SHADOW_CHECK_SAMPLE_RATE = 0.1;
export const GRID_SHADOW_CHECK_MEASUREMENT = 'dashboard_grid_shadow_check';

// The size scenes gives a grid item without a finite width or height
const SCENES_DEFAULT_PANEL_SPAN = 4;

// Kept per grid object so that re-activating a grid (React strict mode activates twice) neither rolls the
// sample again nor checks a layout react-grid-layout has already written back.
const sampledGrids = new WeakMap<SceneGridLayout, boolean>();
const finishedGrids = new WeakSet<SceneGridLayout>();

/**
 * On a sample of loads, compares where react-grid-layout puts the items of a custom grid when it first lays
 * it out with where normalizeLayout says they go, and reports the difference as counts. Only reads state.
 * Call it when the grid's layout manager activates and drop the returned subscription when it deactivates.
 */
export function startGridShadowCheck(grid: SceneGridLayout): Unsubscribable | undefined {
  try {
    if (finishedGrids.has(grid) || !isShadowCheckEnabled() || !isSampled(grid)) {
      return undefined;
    }

    const saved = readLayout(grid.state.children);
    if (!saved || grid.state.UNSAFE_fitPanels) {
      finishedGrids.add(grid);
      return undefined;
    }

    // Scenes writes the layout react-grid-layout reports back onto the children and then always sets a
    // freshly sorted children array, so the first new children array with the same items is that layout.
    const subscription = grid.subscribeToState((next, prev) => {
      if (next.children === prev.children) {
        return;
      }
      subscription.unsubscribe();
      finishedGrids.add(grid);
      try {
        const rendered = readLayout(next.children);
        if (rendered && hasSameKeys(saved, rendered)) {
          logMeasurement(GRID_SHADOW_CHECK_MEASUREMENT, compareWithRendered(saved, rendered));
        }
      } catch {
        logShadowCheckFailure();
      }
    });
    return subscription;
  } catch {
    logShadowCheckFailure();
    return undefined;
  }
}

// The error itself is left out, since its message could contain keys from the dashboard
function logShadowCheckFailure() {
  logDebug('Grid shadow check failed');
}

function isShadowCheckEnabled(): boolean {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaDashboardGridShadowCheck, false);
}

function isSampled(grid: SceneGridLayout): boolean {
  let sampled = sampledGrids.get(grid);
  if (sampled === undefined) {
    sampled = Math.random() < GRID_SHADOW_CHECK_SAMPLE_RATE;
    sampledGrids.set(grid, sampled);
  }
  return sampled;
}

/** The cells scenes hands react-grid-layout, in the same order, or undefined when the grid has rows. */
function readLayout(children: SceneGridItemLike[]): GridLayoutItem[] | undefined {
  const cells: GridLayoutItem[] = [];
  for (const child of children) {
    const { key, x, y, width, height } = child.state;
    if (child instanceof SceneGridRow || !key) {
      return undefined;
    }
    cells.push({
      i: key,
      x: finiteOr(x, 0),
      y: finiteOr(y, 0),
      w: finiteOr(width, SCENES_DEFAULT_PANEL_SPAN),
      h: finiteOr(height, SCENES_DEFAULT_PANEL_SPAN),
    });
  }
  // Compaction breaks ties between items at the same position by order, so sort like scenes does
  return cells.sort((a, b) => a.y - b.y || a.x - b.x);
}

// Number() rather than a type check, because scenes treats null as 0
function finiteOr(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function hasSameKeys(a: GridLayoutItem[], b: GridLayoutItem[]): boolean {
  const keys = new Set(a.map((item) => item.i));
  return keys.size === a.length && a.length === b.length && b.every((item) => keys.has(item.i));
}

function compareWithRendered(saved: GridLayoutItem[], rendered: GridLayoutItem[]): Record<string, number> {
  const expected = new Map(normalizeLayout(saved).map((item) => [item.i, item]));
  const savedByKey = new Map(saved.map((item) => [item.i, item]));

  let mismatchedItemCount = 0;
  let movedItemCount = 0;
  const maxAbsDelta = { x: 0, y: 0, w: 0, h: 0 };

  for (const item of rendered) {
    const ours = expected.get(item.i);
    const before = savedByKey.get(item.i);
    if (!ours || !before) {
      mismatchedItemCount++;
      continue;
    }
    if (!isSamePlacement(item, before)) {
      movedItemCount++;
    }
    if (!isSamePlacement(item, ours)) {
      mismatchedItemCount++;
    }
    maxAbsDelta.x = Math.max(maxAbsDelta.x, Math.abs(item.x - ours.x));
    maxAbsDelta.y = Math.max(maxAbsDelta.y, Math.abs(item.y - ours.y));
    maxAbsDelta.w = Math.max(maxAbsDelta.w, Math.abs(item.w - ours.w));
    maxAbsDelta.h = Math.max(maxAbsDelta.h, Math.abs(item.h - ours.h));
  }

  return {
    sampleRate: GRID_SHADOW_CHECK_SAMPLE_RATE,
    itemCount: rendered.length,
    mismatchedItemCount,
    maxAbsDeltaX: maxAbsDelta.x,
    maxAbsDeltaY: maxAbsDelta.y,
    maxAbsDeltaW: maxAbsDelta.w,
    maxAbsDeltaH: maxAbsDelta.h,
    movedItemCount,
    savedLayoutWasNormalized: movedItemCount === 0 ? 1 : 0,
  };
}

function isSamePlacement(a: GridLayoutItem, b: GridLayoutItem): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}
