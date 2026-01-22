import { FlameGraphDataContainer, LevelItem } from '../../FlameGraph/dataTransform';

import { getBarColorByDiff, getBarColorByPackage, getBarColorByValue } from '../../FlameGraph/colors';

import { GrafanaTheme2 } from '@grafana/data';

import { ColorScheme, ColorSchemeDiff } from '../../types';

export interface CallTreeNode {
  id: string;
  label: string;
  self: number;
  total: number;
  selfPercent: number;
  totalPercent: number;
  depth: number;
  parentId?: string;
  subtreeSize: number;
  levelItem: LevelItem;
  children?: CallTreeNode[];

  selfRight?: number;
  totalRight?: number;
  selfPercentRight?: number;
  totalPercentRight?: number;
  diffPercent?: number;
}

/**
 * Build all call tree nodes from the root level items.
 * Returns an array of root nodes, each with their children.
 * This handles cases where there might be multiple root items.
 *
 * For diff flame graphs, separates left (baseline) and right (comparison) totals
 * to match the Flame Graph's calculation method.
 */
export function buildAllCallTreeNodes(data: FlameGraphDataContainer): CallTreeNode[] {
  const levels = data.getLevels();
  if (levels.length === 0) {
    return [];
  }

  const rootItem = levels[0][0];
  let rootTotalLeft: number;
  let rootTotalRight: number;

  if (data.isDiffFlamegraph()) {
    rootTotalRight = rootItem.valueRight || 0;
    rootTotalLeft = rootItem.value - rootTotalRight;
  } else {
    rootTotalLeft = rootItem.value;
    rootTotalRight = 0;
  }

  return levels[0].map((item, index) =>
    buildCallTreeNode(data, item, rootTotalLeft, rootTotalRight, undefined, -1, index)
  );
}

/**
 * Build a hierarchical call tree node from the LevelItem structure.
 * Each node gets a unique ID based on its path in the tree.
 */
export function buildCallTreeNode(
  data: FlameGraphDataContainer,
  rootItem: LevelItem,
  rootTotalLeft: number,
  rootTotalRight: number,
  parentId?: string,
  parentDepth = -1,
  childIndex = 0
): CallTreeNode {
  const nodeId = parentId ? `${parentId}.${childIndex}` : `${childIndex}`;
  const depth = parentDepth + 1;

  const label = data.getLabel(rootItem.itemIndexes[0]);

  let self: number;
  let total: number;
  let selfPercent: number;
  let totalPercent: number;
  let selfRight: number | undefined;
  let totalRight: number | undefined;
  let selfPercentRight: number | undefined;
  let totalPercentRight: number | undefined;
  let diffPercent: number | undefined;

  if (data.isDiffFlamegraph()) {
    const selfLeft = data.getSelf(rootItem.itemIndexes);
    selfRight = data.getSelfRight(rootItem.itemIndexes);
    const totalLeft = rootItem.value - (rootItem.valueRight || 0);
    totalRight = rootItem.valueRight || 0;

    self = selfLeft;
    total = totalLeft;

    selfPercent = rootTotalLeft > 0 ? (selfLeft / rootTotalLeft) * 100 : 0;
    totalPercent = rootTotalLeft > 0 ? (totalLeft / rootTotalLeft) * 100 : 0;
    selfPercentRight = rootTotalRight > 0 ? (selfRight / rootTotalRight) * 100 : 0;
    totalPercentRight = rootTotalRight > 0 ? (totalRight / rootTotalRight) * 100 : 0;

    // Diff is the percentage change between comparison% and baseline% of TOTAL values
    if (totalPercent > 0) {
      diffPercent = ((totalPercentRight - totalPercent) / totalPercent) * 100;
    } else if (totalPercentRight > 0) {
      diffPercent = Infinity;
    } else {
      diffPercent = 0;
    }
  } else {
    self = data.getSelf(rootItem.itemIndexes);
    total = rootItem.value;
    const rootTotal = rootTotalLeft; // For non-diff, rootTotalRight is 0
    selfPercent = rootTotal > 0 ? (self / rootTotal) * 100 : 0;
    totalPercent = rootTotal > 0 ? (total / rootTotal) * 100 : 0;
  }

  const children =
    rootItem.children.length > 0
      ? rootItem.children.map((child, index) => {
          return buildCallTreeNode(data, child, rootTotalLeft, rootTotalRight, nodeId, depth, index);
        })
      : undefined;

  const subtreeSize = children ? children.reduce((sum, child) => sum + child.subtreeSize + 1, 0) : 0;

  return {
    id: nodeId,
    label,
    self,
    total,
    selfPercent,
    totalPercent,
    depth,
    parentId,
    subtreeSize,
    levelItem: rootItem,
    children,
    selfRight,
    totalRight,
    selfPercentRight,
    totalPercentRight,
    diffPercent,
  };
}

/**
 * Get initial expanded state for the tree.
 * Auto-expands first N levels.
 */
export function getInitialExpandedState(nodes: CallTreeNode[], levelsToExpand = 2): Record<string, boolean> {
  const expanded: Record<string, boolean> = {};

  nodes.forEach((node) => {
    collectExpandedByDepth(node, levelsToExpand, expanded);
  });

  return expanded;
}

/**
 * Recursively collect expanded state for nodes up to a certain depth.
 */
function collectExpandedByDepth(node: CallTreeNode, levelsToExpand: number, expanded: Record<string, boolean>): void {
  if (node.depth < levelsToExpand && node.children && node.children.length > 0) {
    expanded[node.id] = true;
  }

  if (node.children) {
    node.children.forEach((child) => collectExpandedByDepth(child, levelsToExpand, expanded));
  }
}

/**
 * Build a callers tree from sandwich levels data.
 *
 * This follows the same pattern as the flame graph's sandwich mode:
 * - The sandwich transformation (mergeParentSubtrees) creates levels where:
 *   - The last level contains the target function(s)
 *   - Earlier levels contain callers, with `parents` pointing toward the target
 * - We start from the target (last level) and traverse via `parents` to build an inverted tree
 * - Values come directly from item.value (already transformed by sandwich transformation)
 * - Percentages are relative to the target's total (target = 100%), matching sandwich view
 */
export function buildCallersTree(levels: LevelItem[][], data: FlameGraphDataContainer): CallTreeNode[] {
  if (levels.length === 0) {
    return [];
  }

  // The target is at the last level (after sandwich transformation reverses the levels)
  const targetLevel = levels[levels.length - 1];
  if (!targetLevel || targetLevel.length === 0) {
    return [];
  }

  // Calculate separate totals for diff view
  let targetTotalLeft: number;
  let targetTotalRight: number;

  if (data.isDiffFlamegraph()) {
    // For diff: separate left and right totals
    targetTotalRight = targetLevel.reduce((sum, item) => sum + (item.valueRight || 0), 0);
    targetTotalLeft = targetLevel.reduce((sum, item) => sum + item.value, 0) - targetTotalRight;
  } else {
    // For non-diff: all value is "left"
    targetTotalLeft = targetLevel.reduce((sum, item) => sum + item.value, 0);
    targetTotalRight = 0;
  }

  // Build tree node recursively, traversing via parents (callers)
  const buildNode = (item: LevelItem, nodeId: string, depth: number, parentId: string | undefined): CallTreeNode => {
    const label = data.getLabel(item.itemIndexes[0]);

    let self: number;
    let total: number;
    let selfPercent: number;
    let totalPercent: number;
    let selfRight: number | undefined;
    let totalRight: number | undefined;
    let selfPercentRight: number | undefined;
    let totalPercentRight: number | undefined;
    let diffPercent: number | undefined;

    if (data.isDiffFlamegraph()) {
      // For diff view, separate left (baseline) and right (comparison) values
      const selfLeft = data.getSelf(item.itemIndexes);
      selfRight = data.getSelfRight(item.itemIndexes);
      const totalLeft = item.value - (item.valueRight || 0);
      totalRight = item.valueRight || 0;

      // Store the left values as the primary values
      self = selfLeft;
      total = totalLeft;

      // Calculate percentages relative to their respective totals (matching Flame Graph)
      selfPercent = targetTotalLeft > 0 ? (selfLeft / targetTotalLeft) * 100 : 0;
      totalPercent = targetTotalLeft > 0 ? (totalLeft / targetTotalLeft) * 100 : 0;
      selfPercentRight = targetTotalRight > 0 ? (selfRight / targetTotalRight) * 100 : 0;
      totalPercentRight = targetTotalRight > 0 ? (totalRight / targetTotalRight) * 100 : 0;

      // Diff is the percentage change between comparison% and baseline% of TOTAL values
      if (totalPercent > 0) {
        diffPercent = ((totalPercentRight - totalPercent) / totalPercent) * 100;
      } else if (totalPercentRight > 0) {
        diffPercent = Infinity;
      } else {
        diffPercent = 0;
      }
    } else {
      // Non-diff mode
      self = data.getSelf(item.itemIndexes);
      total = item.value;
      selfPercent = targetTotalLeft > 0 ? (self / targetTotalLeft) * 100 : 0;
      totalPercent = targetTotalLeft > 0 ? (total / targetTotalLeft) * 100 : 0;
    }

    // In the callers tree, we traverse via parents (going up the call stack)
    const callers = item.parents || [];
    const children =
      callers.length > 0
        ? callers.map((caller, idx) => {
            return buildNode(caller, `${nodeId}.${idx}`, depth + 1, nodeId);
          })
        : undefined;

    const subtreeSize = children ? children.reduce((sum, child) => sum + child.subtreeSize + 1, 0) : 0;

    return {
      id: nodeId,
      label,
      self,
      total,
      selfPercent,
      totalPercent,
      depth,
      parentId,
      subtreeSize,
      levelItem: item,
      children,
      selfRight,
      totalRight,
      selfPercentRight,
      totalPercentRight,
      diffPercent,
    };
  };

  // Build tree starting from target(s) at the last level
  return targetLevel.map((targetItem, index) => buildNode(targetItem, `${index}`, 0, undefined));
}

export function getRowBarColor(
  node: CallTreeNode,
  data: FlameGraphDataContainer,
  colorScheme: ColorScheme | ColorSchemeDiff,
  theme: GrafanaTheme2
): string {
  if (data.isDiffFlamegraph()) {
    const levels = data.getLevels();
    const rootTotal = levels[0][0].value;
    const rootTotalRight = levels[0][0].valueRight || 0;

    // getBarColorByDiff expects combined total as the first parameter
    // node.total is now the left/baseline value only, so we need to add them back together
    const barColor = getBarColorByDiff(
      node.total + (node.totalRight || 0),
      node.totalRight || 0,
      rootTotal,
      rootTotalRight,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      colorScheme as ColorSchemeDiff
    );
    return barColor.setAlpha(1.0).toString();
  } else {
    if (colorScheme === ColorScheme.ValueBased) {
      const levels = data.getLevels();
      const rootTotal = levels[0][0].value;
      const barColor = getBarColorByValue(node.total, rootTotal, 0, 1);
      return barColor.setAlpha(1.0).toString();
    } else {
      const barColor = getBarColorByPackage(node.label, theme);
      return barColor.setAlpha(1.0).toString();
    }
  }
}
