import { FlameGraphDataContainer, LevelItem } from '../FlameGraph/dataTransform';

export interface CallTreeNode {
  id: string; // Path-based ID (e.g., "0.2.1")
  label: string; // Function name
  self: number; // Self value
  total: number; // Total value
  selfPercent: number; // Self as % of root
  totalPercent: number; // Total as % of root
  depth: number; // Indentation level
  parentId?: string; // Parent node ID
  hasChildren: boolean; // Has expandable children
  childCount: number; // Number of direct children
  subtreeSize: number; // Total number of nodes in subtree (excluding self)
  levelItem: LevelItem; // Reference to original data
  subRows?: CallTreeNode[]; // Child nodes for react-table useExpanded
  isLastChild: boolean; // Whether this is the last child of its parent

  // For diff profiles
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
  parentDepth: number = -1,
  childIndex: number = 0
): CallTreeNode {
  const nodeId = parentId ? `${parentId}.${childIndex}` : `${childIndex}`;
  const depth = parentDepth + 1;

  // Get values for current item
  const itemIndex = rootItem.itemIndexes[0];
  const label = data.getLabel(itemIndex);
  const self = data.getSelf(itemIndex);
  const total = data.getValue(itemIndex);
  const selfPercent = rootTotal > 0 ? (self / rootTotal) * 100 : 0;
  const totalPercent = rootTotal > 0 ? (total / rootTotal) * 100 : 0;

  // For diff profiles
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

    // Calculate diff percentage (change from baseline to comparison)
    if (self > 0) {
      diffPercent = ((selfRight - self) / self) * 100;
    } else if (selfRight > 0) {
      diffPercent = Infinity; // New in comparison
    } else {
      diffPercent = 0;
    }
  }

  // Recursively build children
  const subRows =
    rootItem.children.length > 0
      ? rootItem.children.map((child, index) => {
          const childNode = buildCallTreeNode(data, child, rootTotal, nodeId, depth, index);
          // Mark if this is the last child
          childNode.isLastChild = index === rootItem.children.length - 1;
          return childNode;
        })
      : undefined;

  // Calculate child count and subtree size
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
    isLastChild: false, // Will be set by parent
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

  // Build hierarchical structure for each root item
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

  // Map to track LevelItem -> CallTreeNode for building relationships
  const levelItemToNode = new Map<LevelItem, CallTreeNode>();

  // Process each level and build nodes
  levels.forEach((level, levelIndex) => {
    level.forEach((levelItem, itemIndex) => {
      // Get values from data
      const itemDataIndex = levelItem.itemIndexes[0];
      const label = data.getLabel(itemDataIndex);
      const self = data.getSelf(itemDataIndex);
      const total = data.getValue(itemDataIndex);
      const selfPercent = rootTotal > 0 ? (self / rootTotal) * 100 : 0;
      const totalPercent = rootTotal > 0 ? (total / rootTotal) * 100 : 0;

      // For diff profiles
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

        // Calculate diff percentage
        if (self > 0) {
          diffPercent = ((selfRight - self) / self) * 100;
        } else if (selfRight > 0) {
          diffPercent = Infinity;
        } else {
          diffPercent = 0;
        }
      }

      // Determine parent (if exists)
      let parentId: string | undefined;
      let depth = levelIndex;

      if (levelItem.parents && levelItem.parents.length > 0) {
        const parentNode = levelItemToNode.get(levelItem.parents[0]);
        if (parentNode) {
          parentId = parentNode.id;
          depth = parentNode.depth + 1;
        }
      }

      // Generate path-based ID
      // For root nodes, use index at level 0
      // For child nodes, append index to parent ID
      let nodeId: string;
      if (!parentId) {
        nodeId = `${itemIndex}`;
      } else {
        // Find index among siblings
        const parent = levelItemToNode.get(levelItem.parents![0]);
        const siblingIndex = parent?.subRows?.length || 0;
        nodeId = `${parentId}.${siblingIndex}`;
      }

      // Create the node (without children initially)
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
        subtreeSize: 0, // Will be calculated later
        levelItem,
        subRows: undefined,
        isLastChild: false,
        selfRight,
        totalRight,
        selfPercentRight,
        totalPercentRight,
        diffPercent,
      };

      // Add to map
      levelItemToNode.set(levelItem, node);

      // Add as child to parent
      if (levelItem.parents && levelItem.parents.length > 0) {
        const parentNode = levelItemToNode.get(levelItem.parents[0]);
        if (parentNode) {
          if (!parentNode.subRows) {
            parentNode.subRows = [];
          }
          parentNode.subRows.push(node);
          // Mark if this is the last child
          const isLastChild = parentNode.subRows.length === parentNode.childCount;
          node.isLastChild = isLastChild;
        }
      }
    });
  });

  // Calculate subtreeSize for all nodes (bottom-up)
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

  // Collect root nodes (level 0)
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
export function getInitialExpandedState(nodes: CallTreeNode[], levelsToExpand: number = 2): Record<string, boolean> {
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
  // First, find all paths from root to target node
  const findPathsToTarget = (
    nodes: CallTreeNode[],
    targetLabel: string,
    currentPath: CallTreeNode[] = []
  ): CallTreeNode[][] => {
    const paths: CallTreeNode[][] = [];

    for (const node of nodes) {
      const newPath = [...currentPath, node];

      if (node.label === targetLabel) {
        // Found a path to the target
        paths.push(newPath);
      }

      if (node.subRows && node.subRows.length > 0) {
        // Continue searching in children
        const childPaths = findPathsToTarget(node.subRows, targetLabel, newPath);
        paths.push(...childPaths);
      }
    }

    return paths;
  };

  const paths = findPathsToTarget(nodes, targetLabel);

  if (paths.length === 0) {
    // Target not found, return original tree
    return { restructuredTree: nodes, targetNode: undefined };
  }

  // Get the target node from the first path (they should all have the same target node)
  const targetNode = paths[0][paths[0].length - 1];

  // Now restructure: create a new tree with target at root
  // Each path to the target becomes a branch under the target
  // For example, if we have: root -> A -> B -> target
  // We want: target -> B -> A -> root (inverted)

  const buildInvertedChildren = (paths: CallTreeNode[][]): CallTreeNode[] => {
    // Group paths by their immediate caller (the node right before target)
    const callerGroups = new Map<string, CallTreeNode[][]>();

    for (const path of paths) {
      if (path.length <= 1) {
        // Path is just the target node itself, no callers
        continue;
      }

      // The immediate caller is the node right before the target
      const immediateCaller = path[path.length - 2];
      const callerKey = immediateCaller.label;

      if (!callerGroups.has(callerKey)) {
        callerGroups.set(callerKey, []);
      }
      callerGroups.get(callerKey)!.push(path);
    }

    // Build nodes for each immediate caller
    const callerNodes: CallTreeNode[] = [];
    let callerIndex = 0;

    for (const [, callerPaths] of callerGroups.entries()) {
      // Get the immediate caller node from one of the paths
      const immediateCallerNode = callerPaths[0][callerPaths[0].length - 2];

      // For this caller, recursively build its callers (from the remaining path)
      const remainingPaths = callerPaths.map((path) => path.slice(0, -1)); // Remove target from paths
      const grandCallers = buildInvertedChildren(remainingPaths);

      // Create a new node for this caller as a child of the target
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

      // Update IDs of grandCallers
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

  // Helper to recursively update node IDs
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

  // Build the inverted children for the target
  const invertedChildren = buildInvertedChildren(paths);

  // Create the restructured target node as root
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

  // Find the target node in the levels
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
    if (targetItem) break;
  }

  if (!targetItem || targetLevelIndex === -1) {
    // Target not found
    return { tree: [], targetNode: undefined };
  }

  // Create a map from LevelItem to all items that reference it as a parent
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

  // Build the inverted tree recursively
  // For callers view: the target is root, and parents become children
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

    // For diff profiles
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

    // In the inverted tree, parents become children (callers)
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

  // Build tree with target as root
  const targetNode = buildInvertedNode(targetItem, '0', 0, undefined);

  return { tree: [targetNode], targetNode };
}
