import { FlameGraphDataContainer, LevelItem } from '../FlameGraph/dataTransform';

export interface CallTreeNode {
  id: string;
  label: string;
  self: number;
  total: number;
  selfPercent: number;
  totalPercent: number;
  depth: number;
  parentId?: string;
  hasChildren: boolean;
  childCount: number;
  subtreeSize: number;
  levelItem: LevelItem;
  subRows?: CallTreeNode[];
  isLastChild: boolean;

  selfRight?: number;
  totalRight?: number;
  selfPercentRight?: number;
  totalPercentRight?: number;
  diffPercent?: number;
}

/**
 * Build hierarchical call tree node from the LevelItem structure.
 * Each node gets a unique ID based on its path in the tree.
 * Children are stored in the subRows property for react-table useExpanded.
 *
 * For diff flame graphs:
 * - Baseline and comparison percentages are calculated relative to their respective totals
 * - This matches exactly how the Flame Graph tooltip calculates diff values
 * - Diff % is the percentage change between comparison% and baseline%
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
    // For diff view, separate left (baseline) and right (comparison) values
    // This matches exactly what FlameGraphTooltip.getDiffTooltipData does
    const selfLeft = data.getSelf(rootItem.itemIndexes);
    selfRight = data.getSelfRight(rootItem.itemIndexes);
    const totalLeft = rootItem.value - (rootItem.valueRight || 0);
    totalRight = rootItem.valueRight || 0;

    // Store the left values as the primary values
    self = selfLeft;
    total = totalLeft;

    // Calculate percentages relative to their respective totals (matching Flame Graph)
    selfPercent = rootTotalLeft > 0 ? (selfLeft / rootTotalLeft) * 100 : 0;
    totalPercent = rootTotalLeft > 0 ? (totalLeft / rootTotalLeft) * 100 : 0;
    selfPercentRight = rootTotalRight > 0 ? (selfRight / rootTotalRight) * 100 : 0;
    totalPercentRight = rootTotalRight > 0 ? (totalRight / rootTotalRight) * 100 : 0;

    // Diff is the percentage change between comparison% and baseline% of TOTAL values
    // This matches FlameGraphTooltip: diff = ((percentageRight - percentageLeft) / percentageLeft) * 100
    if (totalPercent > 0) {
      diffPercent = ((totalPercentRight - totalPercent) / totalPercent) * 100;
    } else if (totalPercentRight > 0) {
      diffPercent = Infinity;
    } else {
      diffPercent = 0;
    }
  } else {
    // Non-diff mode: use combined values
    self = data.getSelf(rootItem.itemIndexes);
    total = rootItem.value;
    const rootTotal = rootTotalLeft; // For non-diff, rootTotalRight is 0
    selfPercent = rootTotal > 0 ? (self / rootTotal) * 100 : 0;
    totalPercent = rootTotal > 0 ? (total / rootTotal) * 100 : 0;
  }

  const subRows =
    rootItem.children.length > 0
      ? rootItem.children.map((child, index) => {
          const childNode = buildCallTreeNode(data, child, rootTotalLeft, rootTotalRight, nodeId, depth, index);
          childNode.isLastChild = index === rootItem.children.length - 1;
          return childNode;
        })
      : undefined;

  const childCount = rootItem.children.length;
  const subtreeSize = subRows ? subRows.reduce((sum, child) => sum + child.subtreeSize + 1, 0) : 0;

  const node: CallTreeNode = {
    id: nodeId,
    label,
    self,
    total,
    selfPercent,
    totalPercent,
    depth,
    parentId,
    hasChildren: rootItem.children.length > 0,
    childCount,
    subtreeSize,
    levelItem: rootItem,
    subRows,
    isLastChild: false,
    selfRight,
    totalRight,
    selfPercentRight,
    totalPercentRight,
    diffPercent,
  };

  return node;
}

/**
 * Build all call tree nodes from the root level items.
 * Returns an array of root nodes, each with their children in subRows.
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
    // For diff: separate left and right totals (matching FlameGraphTooltip.getDiffTooltipData)
    rootTotalRight = rootItem.valueRight || 0;
    rootTotalLeft = rootItem.value - rootTotalRight;
  } else {
    // For non-diff: all value is "left", right is 0
    rootTotalLeft = rootItem.value;
    rootTotalRight = 0;
  }

  const rootNodes = levels[0].map((item, index) =>
    buildCallTreeNode(data, item, rootTotalLeft, rootTotalRight, undefined, -1, index)
  );

  return rootNodes;
}

/**
 * Recursively collect expanded state for nodes up to a certain depth.
 */
function collectExpandedByDepth(node: CallTreeNode, levelsToExpand: number, expanded: Record<string, boolean>): void {
  if (node.depth < levelsToExpand && node.hasChildren) {
    expanded[node.id] = true;
  }

  if (node.subRows) {
    node.subRows.forEach((child) => collectExpandedByDepth(child, levelsToExpand, expanded));
  }
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
 * Build a callers tree from sandwich levels data.
 *
 * This follows the same pattern as the flame graph's sandwich mode:
 * - The sandwich transformation (mergeParentSubtrees) creates levels where:
 *   - The last level contains the target function(s)
 *   - Earlier levels contain callers, with `parents` pointing toward the target
 * - We start from the target (last level) and traverse via `parents` to build an inverted tree
 * - Values come directly from item.value (already transformed by sandwich transformation)
 * - Percentages are relative to the target's total (target = 100%), matching sandwich view
 *
 * For diff flame graphs:
 * - Baseline and comparison percentages are calculated relative to their respective totals
 * - This matches exactly how the Flame Graph tooltip calculates diff values
 * - Diff % is the percentage change between comparison% and baseline%
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
      // This matches FlameGraphTooltip: diff = ((percentageRight - percentageLeft) / percentageLeft) * 100
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
    const subRows =
      callers.length > 0
        ? callers.map((caller, idx) => {
            const childNode = buildNode(caller, `${nodeId}.${idx}`, depth + 1, nodeId);
            childNode.isLastChild = idx === callers.length - 1;
            return childNode;
          })
        : undefined;

    const childCount = callers.length;
    const subtreeSize = subRows ? subRows.reduce((sum, child) => sum + child.subtreeSize + 1, 0) : 0;

    return {
      id: nodeId,
      label,
      self,
      total,
      selfPercent,
      totalPercent,
      depth,
      parentId,
      hasChildren: callers.length > 0,
      childCount,
      subtreeSize,
      levelItem: item,
      subRows,
      isLastChild: false,
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
