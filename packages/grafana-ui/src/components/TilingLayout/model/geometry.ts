import { findNode } from './tree';
import { type Axis, type LayoutMetrics, type LayoutNode, type Rect } from './types';

/** The gap between children `index` and `index + 1` of a split. Seams are both resize handles and drop targets. */
export interface SplitDivider {
  splitId: string;
  axis: Axis;
  index: number;
  prevId: string;
  nextId: string;
  rect: Rect;
}

export interface LayoutGeometry {
  /** Pixel rects of every node, relative to the workspace. */
  rects: Map<string, Rect>;
  dividers: SplitDivider[];
}

export interface Size {
  w: number;
  h: number;
}

export function minSize(node: LayoutNode, metrics: LayoutMetrics): Size {
  if (node.kind === 'panel') {
    return { w: metrics.minPanelWidth, h: metrics.minPanelHeight };
  }
  const sizes = node.children.map((c) => minSize(c, metrics));
  const gaps = metrics.gap * (node.children.length - 1);
  if (node.axis === 'x') {
    return { w: sizes.reduce((a, s) => a + s.w, 0) + gaps, h: Math.max(...sizes.map((s) => s.h)) };
  }
  return { w: Math.max(...sizes.map((s) => s.w)), h: sizes.reduce((a, s) => a + s.h, 0) + gaps };
}

export function minAlong(node: LayoutNode, axis: Axis, metrics: LayoutMetrics): number {
  const size = minSize(node, metrics);
  return axis === 'x' ? size.w : size.h;
}

export function sizeAlong(rect: Rect, axis: Axis): number {
  return axis === 'x' ? rect.w : rect.h;
}

/**
 * Splits `total` by weight while keeping every child at or above its minimum. Children with room to spare
 * give it up first. When even the minimums don't fit, children shrink in proportion to their minimums.
 */
export function distributeByWeight(total: number, weights: number[], mins: number[]): number[] {
  const n = weights.length;
  const minTotal = mins.reduce((a, b) => a + b, 0);
  if (minTotal >= total) {
    return minTotal > 0 ? mins.map((m) => (m / minTotal) * total) : weights.map(() => total / n);
  }
  const sizes = new Array<number>(n).fill(0);
  const fixed = new Array<boolean>(n).fill(false);
  for (let pass = 0; pass < n; pass++) {
    let freeTotal = total;
    let freeWeight = 0;
    for (let i = 0; i < n; i++) {
      if (fixed[i]) {
        freeTotal -= sizes[i];
      } else {
        freeWeight += weights[i];
      }
    }
    let clamped = false;
    for (let i = 0; i < n; i++) {
      if (!fixed[i]) {
        sizes[i] = freeWeight > 0 ? (weights[i] / freeWeight) * freeTotal : 0;
        if (sizes[i] < mins[i]) {
          sizes[i] = mins[i];
          fixed[i] = true;
          clamped = true;
        }
      }
    }
    if (!clamped) {
      break;
    }
  }
  return sizes;
}

export function computeGeometry(root: LayoutNode | null, bounds: Rect, metrics: LayoutMetrics): LayoutGeometry {
  const layout: LayoutGeometry = { rects: new Map(), dividers: [] };
  if (root) {
    place(root, bounds, metrics, layout);
  }
  return layout;
}

function place(node: LayoutNode, rect: Rect, metrics: LayoutMetrics, out: LayoutGeometry) {
  out.rects.set(node.id, rect);
  if (node.kind !== 'split') {
    return;
  }
  const { axis, children } = node;
  const { gap } = metrics;
  const length = sizeAlong(rect, axis);
  const start = axis === 'x' ? rect.x : rect.y;
  const available = length - gap * (children.length - 1);
  const sizes = distributeByWeight(
    available,
    node.weights,
    children.map((c) => minAlong(c, axis, metrics))
  );

  let cursor = start;
  let prevEnd = 0;
  children.forEach((child, i) => {
    const from = Math.round(cursor);
    const to = Math.round(cursor + sizes[i]);
    const childRect: Rect =
      axis === 'x' ? { x: from, y: rect.y, w: to - from, h: rect.h } : { x: rect.x, y: from, w: rect.w, h: to - from };
    if (i > 0) {
      out.dividers.push({
        splitId: node.id,
        axis,
        index: i - 1,
        prevId: children[i - 1].id,
        nextId: child.id,
        rect:
          axis === 'x'
            ? { x: prevEnd, y: rect.y, w: from - prevEnd, h: rect.h }
            : { x: rect.x, y: prevEnd, w: rect.w, h: from - prevEnd },
      });
    }
    place(child, childRect, metrics, out);
    prevEnd = to;
    cursor += sizes[i] + gap;
  });
}

export function insetRect(rect: Rect, inset: number): Rect {
  return {
    x: rect.x + inset,
    y: rect.y + inset,
    w: Math.max(0, rect.w - inset * 2),
    h: Math.max(0, rect.h - inset * 2),
  };
}

/**
 * Lays the tree out so that the node `zoomedId` fills `bounds`, like a camera zoomed in on it. The rest
 * of the layout keeps its proportions and extends past the bounds.
 */
export function computeZoomedGeometry(
  root: LayoutNode | null,
  bounds: Rect,
  metrics: LayoutMetrics,
  zoomedId: string | null
): LayoutGeometry {
  const overview = computeGeometry(root, bounds, metrics);
  const framed = zoomedId ? overview.rects.get(zoomedId) : undefined;
  if (!root || !framed || !findNode(root, zoomedId!) || framed.w <= 0 || framed.h <= 0) {
    return overview;
  }
  // Lay out at a larger virtual size so the framed node gets roughly the full bounds and every gap stays
  // the same size on screen, then map the framed node onto the bounds exactly.
  const virtual: Rect = { x: 0, y: 0, w: (bounds.w * bounds.w) / framed.w, h: (bounds.h * bounds.h) / framed.h };
  const zoomed = computeGeometry(root, virtual, metrics);
  const target = zoomed.rects.get(zoomedId!)!;
  const sx = bounds.w / target.w;
  const sy = bounds.h / target.h;
  const map = (r: Rect): Rect => {
    const x0 = Math.round(bounds.x + (r.x - target.x) * sx);
    const y0 = Math.round(bounds.y + (r.y - target.y) * sy);
    const x1 = Math.round(bounds.x + (r.x + r.w - target.x) * sx);
    const y1 = Math.round(bounds.y + (r.y + r.h - target.y) * sy);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };
  const rects = new Map<string, Rect>();
  zoomed.rects.forEach((r, id) => rects.set(id, map(r)));
  return { rects, dividers: zoomed.dividers.map((s) => ({ ...s, rect: map(s.rect) })) };
}

export function rectContains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
}
