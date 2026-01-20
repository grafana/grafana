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
 */
export function buildCallTreeNode(
  data: FlameGraphDataContainer,
  rootItem: LevelItem,
  rootTotal: number,
  parentId?: string,
  parentDepth = -1,
  childIndex = 0
): CallTreeNode {
  const nodeId = parentId ? `${parentId}.${childIndex}` : `${childIndex}`;
  const depth = parentDepth + 1;

  const label = data.getLabel(rootItem.itemIndexes[0]);
  // Use item.value and item.itemIndexes to handle both single and merged items consistently
  const self = data.getSelf(rootItem.itemIndexes);
  const total = rootItem.value;
  const selfPercent = rootTotal > 0 ? (self / rootTotal) * 100 : 0;
  const totalPercent = rootTotal > 0 ? (total / rootTotal) * 100 : 0;

  let selfRight: number | undefined;
  let totalRight: number | undefined;
  let selfPercentRight: number | undefined;
  let totalPercentRight: number | undefined;
  let diffPercent: number | undefined;

  if (data.isDiffFlamegraph()) {
    selfRight = data.getSelfRight(rootItem.itemIndexes);
    totalRight = rootItem.valueRight || 0;
    selfPercentRight = rootTotal > 0 ? (selfRight / rootTotal) * 100 : 0;
    totalPercentRight = rootTotal > 0 ? (totalRight / rootTotal) * 100 : 0;

    if (self > 0) {
      diffPercent = ((selfRight - self) / self) * 100;
    } else if (selfRight > 0) {
      diffPercent = Infinity;
    } else {
      diffPercent = 0;
    }
  }

  const subRows =
    rootItem.children.length > 0
      ? rootItem.children.map((child, index) => {
          const childNode = buildCallTreeNode(data, child, rootTotal, nodeId, depth, index);
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
 */
export function buildAllCallTreeNodes(data: FlameGraphDataContainer): CallTreeNode[] {
  const levels = data.getLevels();
  const rootTotal = levels.length > 0 ? levels[0][0].value : 0;

  const rootNodes = levels[0].map((rootItem, index) =>
    buildCallTreeNode(data, rootItem, rootTotal, undefined, -1, index)
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
 * For self values, we use data.getSelf(item.itemIndexes) which sums the self time
 * for all merged indices, matching how the flame graph tooltip displays self.
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

  // Use target's total as the base for all percentages, matching sandwich view
  // This means: target's totalPercent = 100%, target's selfPercent = self/total (fraction that is self time)
  const targetTotal = targetLevel.reduce((sum, item) => sum + item.value, 0);

  // Build tree node recursively, traversing via parents (callers)
  const buildNode = (item: LevelItem, nodeId: string, depth: number, parentId: string | undefined): CallTreeNode => {
    const label = data.getLabel(item.itemIndexes[0]);

    // Use item.value directly - this is the transformed value from sandwich transformation
    // representing the portion of time that flowed through this call path
    const total = item.value;

    // For self, sum across all merged itemIndexes
    const self = data.getSelf(item.itemIndexes);

    // Both percentages are relative to target's total
    // - totalPercent: what fraction of target's total came through this path (target = 100%)
    // - selfPercent: what fraction of target's total is this node's self time
    const selfPercent = targetTotal > 0 ? (self / targetTotal) * 100 : 0;
    const totalPercent = targetTotal > 0 ? (total / targetTotal) * 100 : 0;

    let selfRight: number | undefined;
    let totalRight: number | undefined;
    let selfPercentRight: number | undefined;
    let totalPercentRight: number | undefined;
    let diffPercent: number | undefined;

    if (data.isDiffFlamegraph()) {
      totalRight = item.valueRight || 0;
      selfRight = data.getSelfRight(item.itemIndexes);
      const targetTotalRight = targetLevel.reduce((sum, item) => sum + (item.valueRight || 0), 0);
      selfPercentRight = targetTotalRight > 0 ? (selfRight / targetTotalRight) * 100 : 0;
      totalPercentRight = targetTotalRight > 0 ? (totalRight / targetTotalRight) * 100 : 0;

      if (self > 0) {
        diffPercent = ((selfRight - self) / self) * 100;
      } else if (selfRight > 0) {
        diffPercent = Infinity;
      } else {
        diffPercent = 0;
      }
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
