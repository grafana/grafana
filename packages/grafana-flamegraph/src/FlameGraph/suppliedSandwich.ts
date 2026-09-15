import { createDataFrame, FieldType, type Field, type GrafanaTheme2 } from '@grafana/data';

import { FlameGraphDataContainer, type LevelItem } from './dataTransform';
import { mergeSubtrees } from './treeTransforms';

/** One node of a sandwich half aggregated outside the displayed flame graph. */
export interface SandwichNode {
  name: string;
  /** On the caller side, only what this node contributed to the sandwich function. */
  total: number;
  /** Meaningless on the caller side, where a node stands for a call path. */
  self: number;
  /** Set on the stand-in for children dropped by truncation. */
  truncated?: boolean;
  children?: SandwichNode[];
}

/**
 * Callers and callees of one function, aggregated over every occurrence of it. A truncated flame
 * graph can neither answer this nor say what it is missing, so a host that can compute it exactly
 * supplies it here instead.
 */
export interface SuppliedSandwich {
  /** Function the halves were built around. A sandwich for any other label is ignored. */
  label: string;
  /** Value whose stack contains the function, counted once per sample. */
  total: number;
  self: number;
  /** Rooted at the function; each child is an immediate caller. */
  callers?: SandwichNode;
  /** Rooted at the function; each child is an immediate callee. */
  callees?: SandwichNode;
}

export interface SuppliedSandwichHalf {
  levels: LevelItem[][];
  /** Answers labels and values for this half's own frame. */
  data: FlameGraphDataContainer;
  /** Whether anything in this half stands in for dropped children. */
  truncated: boolean;
}

/**
 * The renderer resolves everything through a data container and a node's itemIndexes, so a half is
 * turned into a nested set frame of its own and a container built over it. The levels are then
 * assembled by the same mergeSubtrees the client side sandwich uses, which is what keeps the caller
 * half growing outwards towards main rather than downwards.
 */
function halfToLevels(
  root: SandwichNode,
  direction: 'children' | 'parents',
  unitField: Field | undefined,
  theme: GrafanaTheme2 | undefined
): SuppliedSandwichHalf {
  const labels: string[] = [];
  const levelValues: number[] = [];
  const selfValues: number[] = [];
  const values: number[] = [];
  let truncated = false;

  // Pre-order, so a node's row index is the index the renderer will look it up by.
  const walk = (node: SandwichNode, level: number): LevelItem => {
    const index = labels.length;
    labels.push(node.name);
    levelValues.push(level);
    selfValues.push(node.self);
    values.push(node.total);
    truncated = truncated || Boolean(node.truncated);

    const item: LevelItem = { start: 0, value: node.total, itemIndexes: [index], children: [], level };
    const children = (node.children ?? []).map((child) => walk(child, level + 1));
    // The caller half is walked by its parents links, so link it that way and leave children empty.
    if (direction === 'parents') {
      item.parents = children;
      for (const child of children) {
        child.children = [item];
      }
    } else {
      item.children = children;
      for (const child of children) {
        child.parents = [item];
      }
    }
    return item;
  };

  const rootItem = walk(root, 0);

  const frame = createDataFrame({
    name: 'sandwich',
    meta: { preferredVisualisationType: 'flamegraph' },
    fields: [
      { name: 'level', values: levelValues },
      { name: 'label', values: labels, type: FieldType.string },
      { name: 'self', values: selfValues, config: unitField?.config },
      { name: 'value', values: values, config: unitField?.config },
    ],
  });

  const data = new FlameGraphDataContainer(frame, { collapsing: false }, theme);
  // Each supplied node is already merged, so grouping by label is a no-op here; mergeSubtrees is
  // used for the level assembly, start offsets, and the caller side level reversal.
  const levels = mergeSubtrees([rootItem], data, direction);

  return { levels, data, truncated };
}

/**
 * Prepares a supplied sandwich for rendering, or returns undefined when there is nothing usable:
 * no sandwich, one built for a different function, or a function the profile never saw.
 */
export function prepareSuppliedSandwich(
  sandwich: SuppliedSandwich | undefined,
  sandwichItem: string | undefined,
  unitField: Field | undefined,
  theme?: GrafanaTheme2
): { callers?: SuppliedSandwichHalf; callees?: SuppliedSandwichHalf; truncated: boolean } | undefined {
  if (!sandwich || !sandwichItem || sandwich.label !== sandwichItem) {
    return undefined;
  }
  // A function with no occurrences still comes back named, with nothing in it.
  if (!sandwich.total && !sandwich.callers?.children?.length && !sandwich.callees?.children?.length) {
    return undefined;
  }

  const callers = sandwich.callers ? halfToLevels(sandwich.callers, 'parents', unitField, theme) : undefined;
  const callees = sandwich.callees ? halfToLevels(sandwich.callees, 'children', unitField, theme) : undefined;

  if (!callers?.levels.length && !callees?.levels.length) {
    return undefined;
  }

  return { callers, callees, truncated: Boolean(callers?.truncated || callees?.truncated) };
}
