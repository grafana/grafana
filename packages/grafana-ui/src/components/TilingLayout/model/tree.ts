import { type Axis, type LayoutNode, type PanelNode, type Side, type SplitNode } from './types';

/** Id of the placeholder panel used to preview where a drag will land. */
export const DROP_SLOT_ID = '__tiling-drop-slot__';

let idCounter = 0;

export function createId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export function sideAxis(side: Side): Axis {
  return side === 'left' || side === 'right' ? 'x' : 'y';
}

export function isStartSide(side: Side): boolean {
  return side === 'left' || side === 'top';
}

export function findNode(root: LayoutNode | null, id: string): LayoutNode | undefined {
  if (!root) {
    return undefined;
  }
  if (root.id === id) {
    return root;
  }
  if (root.kind === 'split') {
    for (const child of root.children) {
      const found = findNode(child, id);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

export function findParent(root: LayoutNode | null, id: string): { parent: SplitNode; index: number } | undefined {
  if (!root || root.kind !== 'split') {
    return undefined;
  }
  const index = root.children.findIndex((c) => c.id === id);
  if (index >= 0) {
    return { parent: root, index };
  }
  for (const child of root.children) {
    const found = findParent(child, id);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/** The splits from the root down to (and including, when it is a split) the node with this id. */
export function findSplitPath(root: LayoutNode | null, id: string): SplitNode[] | undefined {
  if (!root) {
    return undefined;
  }
  if (root.id === id) {
    return root.kind === 'split' ? [root] : [];
  }
  if (root.kind === 'split') {
    for (const child of root.children) {
      const path = findSplitPath(child, id);
      if (path) {
        return [root, ...path];
      }
    }
  }
  return undefined;
}

export function listPanels(root: LayoutNode | null, out: PanelNode[] = []): PanelNode[] {
  if (!root) {
    return out;
  }
  if (root.kind === 'panel') {
    out.push(root);
  } else {
    root.children.forEach((c) => listPanels(c, out));
  }
  return out;
}

export function containsNode(root: LayoutNode, id: string): boolean {
  return findNode(root, id) !== undefined;
}

/** Replaces the node with `id` by the result of `fn`, without normalizing. */
export function replaceNode(root: LayoutNode, id: string, fn: (node: LayoutNode) => LayoutNode): LayoutNode {
  if (root.id === id) {
    return fn(root);
  }
  if (root.kind === 'split') {
    let changed = false;
    const children = root.children.map((child) => {
      const next = replaceNode(child, id, fn);
      changed = changed || next !== child;
      return next;
    });
    return changed ? { ...root, children } : root;
  }
  return root;
}

/**
 * Removes a node. Its space goes to the next sibling, or the previous one when it was last,
 * so the rest of the layout stays where it was.
 */
export function removeNode(root: LayoutNode | null, id: string): LayoutNode | null {
  if (!root) {
    return null;
  }
  if (root.id === id) {
    return null;
  }
  return normalize(removeNodeRaw(root, id));
}

function removeNodeRaw(node: LayoutNode, id: string): LayoutNode {
  if (node.kind !== 'split') {
    return node;
  }
  const index = node.children.findIndex((c) => c.id === id);
  if (index >= 0) {
    return removeChildAt(node, index);
  }
  let changed = false;
  const children = node.children.map((child) => {
    const next = removeNodeRaw(child, id);
    changed = changed || next !== child;
    return next;
  });
  return changed ? { ...node, children } : node;
}

function removeChildAt(split: SplitNode, index: number): SplitNode {
  const weights = [...split.weights];
  const freed = weights[index];
  const heir = index + 1 < weights.length ? index + 1 : index - 1;
  if (heir >= 0) {
    weights[heir] += freed;
  }
  weights.splice(index, 1);
  const children = [...split.children];
  children.splice(index, 1);
  return { ...split, children, weights };
}

function fixWeights(weights: number[], count: number): number[] {
  const valid = weights.slice(0, count).filter((w) => Number.isFinite(w) && w > 0);
  const fallback = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 1;
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    const w = weights[i];
    result.push(Number.isFinite(w) && w > 0 ? w : fallback);
  }
  return result;
}

/**
 * Removes empty panels and splits, collapses single-child splits into their child, flattens a split
 * nested directly in a split on the same axis, and repairs invalid weights.
 */
export function normalize(node: LayoutNode | null): LayoutNode | null {
  if (!node) {
    return null;
  }
  if (node.kind === 'panel') {
    if (node.views.length === 0) {
      return node.id === DROP_SLOT_ID ? node : null;
    }
    if (!node.views.includes(node.selected)) {
      return { ...node, selected: node.views[0] };
    }
    return node;
  }

  let split: SplitNode = { ...node, weights: fixWeights(node.weights, node.children.length) };
  // Drop empty children first, handing their space to a neighbour.
  for (let i = split.children.length - 1; i >= 0; i--) {
    const next = normalize(split.children[i]);
    if (next === null) {
      split = removeChildAt(split, i);
    } else if (next !== split.children[i]) {
      const children = [...split.children];
      children[i] = next;
      split = { ...split, children };
    }
  }

  const children: LayoutNode[] = [];
  const weights: number[] = [];
  split.children.forEach((child, i) => {
    if (child.kind === 'split' && child.axis === split.axis) {
      const total = child.weights.reduce((a, b) => a + b, 0) || 1;
      child.children.forEach((grandChild, j) => {
        children.push(grandChild);
        weights.push((split.weights[i] * child.weights[j]) / total);
      });
    } else {
      children.push(child);
      weights.push(split.weights[i]);
    }
  });

  if (children.length === 0) {
    return null;
  }
  if (children.length === 1) {
    return children[0];
  }
  return { ...split, children, weights };
}

/** Inserts a child at `index`. The new child gets 1/(n+1) of the split and the others keep their ratios. */
export function insertIntoSplit(split: SplitNode, index: number, node: LayoutNode, weight?: number): SplitNode {
  const total = split.weights.reduce((a, b) => a + b, 0);
  const children = [...split.children];
  const weights = [...split.weights];
  children.splice(index, 0, node);
  weights.splice(index, 0, weight ?? total / split.children.length);
  return { ...split, children, weights };
}

export interface InsertBesideOptions {
  /** Fraction of the target's space the new node takes. Defaults to an even share. */
  shareOfTarget?: number;
}

/**
 * Places `node` next to the node with `targetId`. When the target's parent runs along the same axis, the
 * node is inserted into that parent. Otherwise the target is split in two.
 */
export function insertBeside(
  root: LayoutNode,
  targetId: string,
  side: Side,
  node: LayoutNode,
  options: InsertBesideOptions = {}
): LayoutNode {
  const axis = sideAxis(side);
  const start = isStartSide(side);
  const share = options.shareOfTarget;
  const location = findParent(root, targetId);

  if (location && location.parent.axis === axis) {
    const { parent, index } = location;
    const result = replaceNode(root, parent.id, () => {
      if (share === undefined) {
        return insertIntoSplit(parent, start ? index : index + 1, node);
      }
      const targetWeight = parent.weights[index];
      const updated = { ...parent, weights: [...parent.weights] };
      updated.weights[index] = targetWeight * (1 - share);
      return insertIntoSplit(updated, start ? index : index + 1, node, targetWeight * share);
    });
    return normalize(result) ?? node;
  }

  const s = share ?? 0.5;
  const result = replaceNode(root, targetId, (target) => ({
    kind: 'split',
    id: createId('split'),
    axis,
    children: start ? [node, target] : [target, node],
    weights: start ? [s, 1 - s] : [1 - s, s],
  }));
  return normalize(result) ?? node;
}

/** Inserts `node` along one edge of the whole layout. */
export function insertAtRootEdge(root: LayoutNode | null, side: Side, node: LayoutNode): LayoutNode {
  if (!root) {
    return node;
  }
  const axis = sideAxis(side);
  const start = isStartSide(side);
  if (root.kind === 'split' && root.axis === axis) {
    return normalize(insertIntoSplit(root, start ? 0 : root.children.length, node)) ?? node;
  }
  const split: SplitNode = {
    kind: 'split',
    id: createId('split'),
    axis,
    children: start ? [node, root] : [root, node],
    weights: [1, 1],
  };
  return normalize(split) ?? node;
}

export function mapPanels(root: LayoutNode | null, fn: (panel: PanelNode) => PanelNode | null): LayoutNode | null {
  if (!root) {
    return null;
  }
  const visit = (node: LayoutNode): LayoutNode => {
    if (node.kind === 'panel') {
      return fn(node) ?? { ...node, views: [] };
    }
    let changed = false;
    const children = node.children.map((c) => {
      const next = visit(c);
      changed = changed || next !== c;
      return next;
    });
    return changed ? { ...node, children } : node;
  };
  const next = visit(root);
  return next === root ? root : normalize(next);
}

/** Replaces the weights of the given splits. */
export function setSplitWeights(root: LayoutNode, weights: Map<string, number[]>): LayoutNode {
  if (root.kind !== 'split') {
    return root;
  }
  const own = weights.get(root.id);
  let changed = own !== undefined;
  const children = root.children.map((c) => {
    const next = setSplitWeights(c, weights);
    changed = changed || next !== c;
    return next;
  });
  return changed ? { ...root, children, weights: own ?? root.weights } : root;
}
