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
 * Build call tree nodes from an array of levels (from mergeParentSubtrees).
 * This is used for the callers view where we get LevelItem[][] from getSandwichLevels.
 * Unlike buildCallTreeNode which recursively processes children, this function
 * processes pre-organized levels and builds the hierarchy from them.
 */
export function buildCallTreeFromLevels(
  levels: LevelItem[][],
  data: FlameGraphDataContainer,
  rootTotal: number
): CallTreeNode[] {
  if (levels.length === 0 || levels[0].length === 0) {
    return [];
  }

  const levelItemToNode = new Map<LevelItem, CallTreeNode>();

  levels.forEach((level, levelIndex) => {
    level.forEach((levelItem, itemIndex) => {
      const itemDataIndex = levelItem.itemIndexes[0];
      const label = data.getLabel(itemDataIndex);
      const self = data.getSelf(itemDataIndex);
      const total = data.getValue(itemDataIndex);
      const selfPercent = rootTotal > 0 ? (self / rootTotal) * 100 : 0;
      const totalPercent = rootTotal > 0 ? (total / rootTotal) * 100 : 0;

      let selfRight: number | undefined;
      let totalRight: number | undefined;
      let selfPercentRight: number | undefined;
      let totalPercentRight: number | undefined;
      let diffPercent: number | undefined;

      if (data.isDiffFlamegraph()) {
        selfRight = data.getSelfRight(itemDataIndex);
        totalRight = data.getValueRight(itemDataIndex);
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

      let parentId: string | undefined;
      let depth = levelIndex;

      if (levelItem.parents && levelItem.parents.length > 0) {
        const parentNode = levelItemToNode.get(levelItem.parents[0]);
        if (parentNode) {
          parentId = parentNode.id;
          depth = parentNode.depth + 1;
        }
      }

      let nodeId: string;
      if (!parentId) {
        nodeId = `${itemIndex}`;
      } else {
        const parent = levelItemToNode.get(levelItem.parents![0]);
        const siblingIndex = parent?.subRows?.length || 0;
        nodeId = `${parentId}.${siblingIndex}`;
      }

      const node: CallTreeNode = {
        id: nodeId,
        label,
        self,
        total,
        selfPercent,
        totalPercent,
        depth,
        parentId,
        hasChildren: levelItem.children.length > 0,
        childCount: levelItem.children.length,
        subtreeSize: 0,
        levelItem,
        subRows: undefined,
        isLastChild: false,
        selfRight,
        totalRight,
        selfPercentRight,
        totalPercentRight,
        diffPercent,
      };

      levelItemToNode.set(levelItem, node);

      if (levelItem.parents && levelItem.parents.length > 0) {
        const parentNode = levelItemToNode.get(levelItem.parents[0]);
        if (parentNode) {
          if (!parentNode.subRows) {
            parentNode.subRows = [];
          }
          parentNode.subRows.push(node);
          const isLastChild = parentNode.subRows.length === parentNode.childCount;
          node.isLastChild = isLastChild;
        }
      }
    });
  });

  const calculateSubtreeSize = (node: CallTreeNode): number => {
    if (!node.subRows || node.subRows.length === 0) {
      node.subtreeSize = 0;
      return 0;
    }

    const size = node.subRows.reduce((sum, child) => {
      return sum + calculateSubtreeSize(child) + 1;
    }, 0);

    node.subtreeSize = size;
    return size;
  };

  const rootNodes: CallTreeNode[] = [];
  levels[0].forEach((levelItem) => {
    const node = levelItemToNode.get(levelItem);
    if (node) {
      calculateSubtreeSize(node);
      rootNodes.push(node);
    }
  });

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
 * Restructure the callers tree to show a specific target node at the root.
 * In the callers view, we want to show the target function with its callers as children.
 * This function finds the target node and collects all paths that lead to it,
 * then restructures them so the target is at the root.
 */
export function restructureCallersTree(
  nodes: CallTreeNode[],
  targetLabel: string
): { restructuredTree: CallTreeNode[]; targetNode: CallTreeNode | undefined } {
  const findPathsToTarget = (
    nodes: CallTreeNode[],
    targetLabel: string,
    currentPath: CallTreeNode[] = []
  ): CallTreeNode[][] => {
    const paths: CallTreeNode[][] = [];

    for (const node of nodes) {
      const newPath = [...currentPath, node];

      if (node.label === targetLabel) {
        paths.push(newPath);
      }

      if (node.subRows && node.subRows.length > 0) {
        const childPaths = findPathsToTarget(node.subRows, targetLabel, newPath);
        paths.push(...childPaths);
      }
    }

    return paths;
  };

  const paths = findPathsToTarget(nodes, targetLabel);

  if (paths.length === 0) {
    return { restructuredTree: nodes, targetNode: undefined };
  }

  const targetNode = paths[0][paths[0].length - 1];

  const buildInvertedChildren = (paths: CallTreeNode[][]): CallTreeNode[] => {
    const callerGroups = new Map<string, CallTreeNode[][]>();

    for (const path of paths) {
      if (path.length <= 1) {
        continue;
      }

      const immediateCaller = path[path.length - 2];
      const callerKey = immediateCaller.label;

      if (!callerGroups.has(callerKey)) {
        callerGroups.set(callerKey, []);
      }
      callerGroups.get(callerKey)!.push(path);
    }

    const callerNodes: CallTreeNode[] = [];
    let callerIndex = 0;

    for (const [, callerPaths] of callerGroups.entries()) {
      const immediateCallerNode = callerPaths[0][callerPaths[0].length - 2];

      const remainingPaths = callerPaths.map((path) => path.slice(0, -1));
      const grandCallers = buildInvertedChildren(remainingPaths);

      const newCallerId = `0.${callerIndex}`;
      const callerNode: CallTreeNode = {
        ...immediateCallerNode,
        id: newCallerId,
        depth: 1,
        parentId: '0',
        subRows: grandCallers.length > 0 ? grandCallers : undefined,
        hasChildren: grandCallers.length > 0,
        childCount: grandCallers.length,
        isLastChild: callerIndex === callerGroups.size - 1,
      };

      if (grandCallers.length > 0) {
        grandCallers.forEach((grandCaller, idx) => {
          updateNodeIds(grandCaller, newCallerId, idx);
        });
      }

      callerNodes.push(callerNode);
      callerIndex++;
    }

    return callerNodes;
  };

  const updateNodeIds = (node: CallTreeNode, parentId: string, index: number) => {
    node.id = `${parentId}.${index}`;
    node.parentId = parentId;
    node.depth = parentId.split('.').length;

    if (node.subRows) {
      node.subRows.forEach((child, idx) => {
        updateNodeIds(child, node.id, idx);
      });
    }
  };

  const invertedChildren = buildInvertedChildren(paths);

  const restructuredTarget: CallTreeNode = {
    ...targetNode,
    id: '0',
    depth: 0,
    parentId: undefined,
    subRows: invertedChildren.length > 0 ? invertedChildren : undefined,
    hasChildren: invertedChildren.length > 0,
    childCount: invertedChildren.length,
    subtreeSize: invertedChildren.reduce((sum, child) => sum + child.subtreeSize + 1, 0),
    isLastChild: false,
  };

  return { restructuredTree: [restructuredTarget], targetNode: restructuredTarget };
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
    const self = data.getSelf(itemIdx);
    const total = data.getValue(itemIdx);
    const selfPercent = rootTotal > 0 ? (self / rootTotal) * 100 : 0;
    const totalPercent = rootTotal > 0 ? (total / rootTotal) * 100 : 0;

    let selfRight: number | undefined;
    let totalRight: number | undefined;
    let selfPercentRight: number | undefined;
    let totalPercentRight: number | undefined;
    let diffPercent: number | undefined;

    if (data.isDiffFlamegraph()) {
      selfRight = data.getSelfRight(itemIdx);
      totalRight = data.getValueRight(itemIdx);
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
