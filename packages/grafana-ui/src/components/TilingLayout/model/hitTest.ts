import { type ComputedLayout, rectContains } from './layout';
import { DROP_SLOT_ID, listPanels } from './tree';
import { type DropTarget, type LayoutDocument, type LayoutMetrics, type Point, type Rect, type Side } from './types';

/** The outer share of a panel on each side that docks beside it. */
export const EDGE_BAND = 0.28;
/** The narrower edge band used while moving a floating panel, so it can pass over panels freely. */
export const FLOAT_EDGE_BAND = 0.14;
/** How far past the gap itself a seam still counts as hit. */
const SEAM_TOLERANCE = 2;

export interface FloatingHitRect {
  panelId: string;
  rect: Rect;
  z: number;
}

export interface HitTestInput {
  point: Point;
  viewport: Rect;
  doc: LayoutDocument;
  layout: ComputedLayout;
  floating: FloatingHitRect[];
  metrics: LayoutMetrics;
  /** A docked panel being dragged that still occupies its slot. Hovering it means "no change". */
  selfPanelId?: string;
  /** Floating panel being moved; it is never a target and docks only on narrow bands. */
  movingFloatId?: string;
  /** Returns the tab index in a panel's strip for a pointer x. */
  tabIndexAt: (panelId: string, x: number) => number;
}

export type HitResult = DropTarget | 'self' | null;

export function hitTest(input: HitTestInput): HitResult {
  const { point, viewport, doc, layout, metrics, tabIndexAt } = input;
  const { x, y } = point;
  if (!rectContains(viewport, x, y)) {
    return null;
  }
  const isFloatMove = input.movingFloatId !== undefined;

  // Floats sit above everything: their tab bar or body adds the view as a tab.
  const floats = input.floating
    .filter((f) => f.panelId !== input.movingFloatId && rectContains(f.rect, x, y))
    .sort((a, b) => b.z - a.z);
  if (floats.length) {
    const f = floats[0];
    const inTabBar = y < f.rect.y + metrics.tabBarHeight;
    const panel = doc.floating.find((p) => p.panel.id === f.panelId)?.panel;
    return { kind: 'tab', panelId: f.panelId, index: inTabBar ? tabIndexAt(f.panelId, x) : (panel?.views.length ?? 0) };
  }

  if (!doc.root) {
    return { kind: 'root' };
  }

  // The outer frame band beats everything in the docked layout.
  const band = Math.max(metrics.gap, 8);
  const edgeDistances: Array<[Side, number]> = [
    ['left', x - viewport.x],
    ['right', viewport.x + viewport.w - x],
    ['top', y - viewport.y],
    ['bottom', viewport.y + viewport.h - y],
  ];
  const nearestFrame = edgeDistances.filter(([, d]) => d <= band).sort((a, b) => a[1] - b[1])[0];
  if (nearestFrame) {
    return { kind: 'frame', side: nearestFrame[0] };
  }

  // Seams beat panel edges; the nearest one wins where seams meet.
  let bestSeam: { target: DropTarget; distance: number } | undefined;
  for (const seam of layout.seams) {
    if (seam.prevId === DROP_SLOT_ID || seam.nextId === DROP_SLOT_ID) {
      continue;
    }
    const r = seam.rect;
    const expanded: Rect =
      seam.axis === 'x'
        ? { x: r.x - SEAM_TOLERANCE, y: r.y, w: r.w + SEAM_TOLERANCE * 2, h: r.h }
        : { x: r.x, y: r.y - SEAM_TOLERANCE, w: r.w, h: r.h + SEAM_TOLERANCE * 2 };
    if (!rectContains(expanded, x, y)) {
      continue;
    }
    const distance = seam.axis === 'x' ? Math.abs(x - (r.x + r.w / 2)) : Math.abs(y - (r.y + r.h / 2));
    if (!bestSeam || distance < bestSeam.distance) {
      bestSeam = {
        distance,
        target: { kind: 'seam', splitId: seam.splitId, axis: seam.axis, prevId: seam.prevId, nextId: seam.nextId },
      };
    }
  }
  if (bestSeam) {
    return bestSeam.target;
  }

  const panel = listPanels(doc.root).find((p) => {
    const r = layout.rects.get(p.id);
    return p.id !== DROP_SLOT_ID && r && rectContains(r, x, y);
  });
  if (!panel) {
    return null;
  }
  if (panel.id === input.selfPanelId) {
    return 'self';
  }
  const r = layout.rects.get(panel.id)!;
  if (y < r.y + metrics.tabBarHeight) {
    return { kind: 'tab', panelId: panel.id, index: tabIndexAt(panel.id, x) };
  }

  const bandShare = isFloatMove ? FLOAT_EDGE_BAND : EDGE_BAND;
  const fx = (x - r.x) / r.w;
  const fy = (y - r.y) / r.h;
  const sides: Array<[Side, number]> = [
    ['left', fx],
    ['right', 1 - fx],
    ['top', fy],
    ['bottom', 1 - fy],
  ];
  const edge = sides.filter(([, d]) => d < bandShare).sort((a, b) => a[1] - b[1])[0];
  if (edge) {
    return { kind: 'edge', panelId: panel.id, side: edge[0] };
  }
  return isFloatMove ? null : { kind: 'tab', panelId: panel.id, index: panel.views.length };
}

export function targetKey(target: DropTarget | null): string {
  if (!target) {
    return 'none';
  }
  if (target.kind === 'float') {
    return 'float';
  }
  return JSON.stringify(target);
}
