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

  const itemIndex = rootItem.itemIndexes[0];
  const label = data.getLabel(itemIndex);
  const self = data.getSelf(itemIndex);
  const total = data.getValue(itemIndex);
  const selfPercent = rootTotal > 0 ? (self / rootTotal) * 100 : 0;
  const totalPercent = rootTotal > 0 ? (total / rootTotal) * 100 : 0;

  let selfRight: number | undefined;
  let totalRight: number | undefined;
  let selfPercentRight: number | undefined;
  let totalPercentRight: number | undefined;
  let diffPercent: number | undefined;

  if (data.isDiffFlamegraph()) {
    selfRight = data.getSelfRight(itemIndex);
    totalRight = data.getValueRight(itemIndex);
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
 * Build a callers tree directly from sandwich levels data.
 * This creates an inverted tree where the target function is at the root
 * and its callers are shown as children.
 */
export function buildCallersTreeFromLevels(
  levels: LevelItem[][],
  targetLabel: string,
  data: FlameGraphDataContainer,
  rootTotal: number
): { tree: CallTreeNode[]; targetNode: CallTreeNode | undefined } {
  if (levels.length === 0) {
    return { tree: [], targetNode: undefined };
  }

  let targetLevelIndex = -1;
  let targetItem: LevelItem | undefined;

  for (let i = 0; i < levels.length; i++) {
    for (const item of levels[i]) {
      const label = data.getLabel(item.itemIndexes[0]);
      if (label === targetLabel) {
        targetLevelIndex = i;
        targetItem = item;
        break;
      }
    }
    if (targetItem) {
      break;
    }
  }

  if (!targetItem || targetLevelIndex === -1) {
    return { tree: [], targetNode: undefined };
  }

  const childrenMap = new Map<LevelItem, LevelItem[]>();

  for (const level of levels) {
    for (const item of level) {
      if (item.parents) {
        for (const parent of item.parents) {
          if (!childrenMap.has(parent)) {
            childrenMap.set(parent, []);
          }
          childrenMap.get(parent)!.push(item);
        }
      }
    }
  }

  const buildInvertedNode = (
    item: LevelItem,
    nodeId: string,
    depth: number,
    parentId: string | undefined
  ): CallTreeNode => {
    const itemIdx = item.itemIndexes[0];
    const label = data.getLabel(itemIdx);
    // Use item.value from the sandwich transformation, not original data frame values.
    // The sandwich transformation modifies values to represent only the portion
    // that flowed through each call path to the target function.
    const total = item.value;
    // For self, sum across all merged item indexes since itemIndexes can contain multiple
    // indices when same-label items are merged.
    const self = item.itemIndexes.reduce((sum, idx) => sum + data.getSelf(idx), 0);
    const selfPercent = rootTotal > 0 ? (self / rootTotal) * 100 : 0;
    const totalPercent = rootTotal > 0 ? (total / rootTotal) * 100 : 0;

    let selfRight: number | undefined;
    let totalRight: number | undefined;
    let selfPercentRight: number | undefined;
    let totalPercentRight: number | undefined;
    let diffPercent: number | undefined;

    if (data.isDiffFlamegraph()) {
      // Use item.valueRight from the sandwich transformation for consistency with total
      totalRight = item.valueRight || 0;
      selfRight = item.itemIndexes.reduce((sum, idx) => sum + data.getSelfRight(idx), 0);
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

    const callers = item.parents || [];
    const subRows =
      callers.length > 0
        ? callers.map((caller, idx) => {
            const callerId = `${nodeId}.${idx}`;
            const callerNode = buildInvertedNode(caller, callerId, depth + 1, nodeId);
            callerNode.isLastChild = idx === callers.length - 1;
            return callerNode;
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

  const targetNode = buildInvertedNode(targetItem, '0', 0, undefined);

  return { tree: [targetNode], targetNode };
}
