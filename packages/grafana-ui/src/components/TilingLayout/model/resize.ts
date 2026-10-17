import { type ComputedLayout, minAlong, sizeAlong } from './layout';
import { findSplitPath, replaceNode, setSplitWeights } from './tree';
import { type LayoutMetrics, type LayoutNode, type SplitNode } from './types';

/**
 * Moves the divider between children `index` and `index + 1` of a split by `delta` pixels.
 *
 * Space comes from the nearest neighbour first. Past its minimum the divider pushes the next one along, up
 * to the edge of the split, and from there pushes the split's own edge into the panels around it, up to the
 * edge of the workspace. Everything that doesn't have to move keeps its size.
 */
export function resizeSplit(
  root: LayoutNode,
  layout: ComputedLayout,
  metrics: LayoutMetrics,
  splitId: string,
  index: number,
  delta: number
): LayoutNode {
  const path = findSplitPath(root, splitId);
  const split = path?.[path.length - 1];
  if (!path || !split || split.id !== splitId || delta === 0 || index < 0 || index >= split.children.length - 1) {
    return root;
  }

  const sizes = new Map<string, number[]>();
  const sizesOf = (s: SplitNode): number[] => {
    let current = sizes.get(s.id);
    if (!current) {
      current = s.children.map((c) => {
        const rect = layout.rects.get(c.id);
        return rect ? sizeAlong(rect, s.axis) : 0;
      });
      sizes.set(s.id, current);
    }
    return current;
  };

  // Shrinks children of `s` starting at `from` and moving in `dir`, nearest first. Returns what it took.
  const take = (s: SplitNode, from: number, dir: 1 | -1, amount: number): number => {
    const current = sizesOf(s);
    let remaining = amount;
    for (let k = from; k >= 0 && k < s.children.length && remaining > 0; k += dir) {
      const room = Math.max(0, current[k] - minAlong(s.children[k], s.axis, metrics));
      const t = Math.min(room, remaining);
      current[k] -= t;
      remaining -= t;
    }
    return amount - remaining;
  };

  // Pushes the outer edge of path[depth] (its end edge when dir is 1) into the panels around it.
  const pushEdge = (depth: number, dir: 1 | -1, amount: number): number => {
    const axis = path[depth].axis;
    for (let k = depth - 1; k >= 0; k--) {
      const ancestor = path[k];
      if (ancestor.axis !== axis) {
        continue;
      }
      const j = ancestor.children.findIndex((c) => c.id === path[k + 1].id);
      const taken = take(ancestor, j + dir, dir, amount);
      const pushed = taken < amount ? pushEdge(k, dir, amount - taken) : 0;
      sizesOf(ancestor)[j] += taken + pushed;
      return taken + pushed;
    }
    return 0;
  };

  const dir: 1 | -1 = delta > 0 ? 1 : -1;
  const amount = Math.abs(delta);
  const growIndex = dir === 1 ? index : index + 1;
  const shrinkFrom = dir === 1 ? index + 1 : index;
  const own = sizesOf(split);
  const taken = take(split, shrinkFrom, dir, amount);
  const pushed = taken < amount ? pushEdge(path.length - 1, dir, amount - taken) : 0;
  own[growIndex] += taken + pushed;

  return setSplitWeights(root, sizes);
}

/** Gives the two children on either side of a divider the same size. */
export function evenSplit(root: LayoutNode, splitId: string, index: number): LayoutNode {
  return replaceNode(root, splitId, (node) => {
    if (node.kind !== 'split' || index < 0 || index >= node.children.length - 1) {
      return node;
    }
    const weights = [...node.weights];
    const avg = (weights[index] + weights[index + 1]) / 2;
    weights[index] = avg;
    weights[index + 1] = avg;
    return { ...node, weights };
  });
}
