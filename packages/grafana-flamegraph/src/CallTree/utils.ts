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
  const rootNodes = levels[0].map((rootItem, index) => buildCallTreeNode(data, rootItem, rootTotal, undefined, -1, index));

  return rootNodes;
}

export interface FilterResult {
  visibleNodes: CallTreeNode[];
  matchingNodeIds: Set<string>;
}

/**
 * Recursively collect all matching node IDs from the tree.
 */
function collectMatchingNodes(node: CallTreeNode, matchedLabels: Set<string>, matchingIds: Set<string>): boolean {
  let hasMatch = false;

  // Check if current node matches
  if (matchedLabels.has(node.label)) {
    matchingIds.add(node.id);
    hasMatch = true;
  }

  // Check children
  if (node.subRows) {
    for (const child of node.subRows) {
      if (collectMatchingNodes(child, matchedLabels, matchingIds)) {
        hasMatch = true;
      }
    }
  }

  return hasMatch;
}

/**
 * Recursively filter tree to show only matching nodes and their ancestors/descendants.
 * Returns a new tree with filtered structure.
 */
function filterNode(node: CallTreeNode, matchedLabels: Set<string>, matchingIds: Set<string>): CallTreeNode | null {
  // First, filter children recursively
  let filteredSubRows: CallTreeNode[] | undefined;
  if (node.subRows) {
    filteredSubRows = node.subRows
      .map((child) => filterNode(child, matchedLabels, matchingIds))
      .filter((child): child is CallTreeNode => child !== null);
  }

  // Check if this node or any descendant matches
  const nodeMatches = matchingIds.has(node.id);
  const hasMatchingDescendants = filteredSubRows && filteredSubRows.length > 0;

  // Keep node if it matches or has matching descendants
  if (nodeMatches || hasMatchingDescendants) {
    return {
      ...node,
      subRows: filteredSubRows,
      hasChildren: filteredSubRows ? filteredSubRows.length > 0 : false,
    };
  }

  return null;
}

/**
 * Filter call tree to show only matching nodes and their ancestors.
 * Non-matching ancestors are kept for context but will be visually dimmed.
 */
export function filterCallTree(nodes: CallTreeNode[], matchedLabels?: Set<string>): FilterResult {
  if (!matchedLabels || matchedLabels.size === 0) {
    return { visibleNodes: nodes, matchingNodeIds: new Set() };
  }

  const matchingNodeIds = new Set<string>();

  // First pass: collect all matching node IDs
  nodes.forEach((node) => {
    collectMatchingNodes(node, matchedLabels, matchingNodeIds);
  });

  // Second pass: filter tree structure
  const visibleNodes = nodes
    .map((node) => filterNode(node, matchedLabels, matchingNodeIds))
    .filter((node): node is CallTreeNode => node !== null);

  return { visibleNodes, matchingNodeIds };
}

/**
 * Recursively collect expanded state for nodes up to a certain depth.
 */
function collectExpandedByDepth(
  node: CallTreeNode,
  levelsToExpand: number,
  expanded: Record<string, boolean>
): void {
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
 * Recursively collect expanded state to reveal matching nodes.
 */
function collectExpandedForMatches(
  node: CallTreeNode,
  matchingNodeIds: Set<string>,
  expanded: Record<string, boolean>
): boolean {
  let hasMatchingDescendant = false;

  // Check if this node matches
  if (matchingNodeIds.has(node.id)) {
    hasMatchingDescendant = true;
  }

  // Check children
  if (node.subRows) {
    for (const child of node.subRows) {
      if (collectExpandedForMatches(child, matchingNodeIds, expanded)) {
        hasMatchingDescendant = true;
      }
    }
  }

  // Expand this node if it has matching descendants
  if (hasMatchingDescendant && node.hasChildren) {
    expanded[node.id] = true;
  }

  return hasMatchingDescendant;
}

/**
 * Get expanded state to reveal matching nodes when filtering.
 * Expands ancestors of matching nodes.
 */
export function getExpandedStateForMatches(
  nodes: CallTreeNode[],
  matchingNodeIds: Set<string>
): Record<string, boolean> {
  const expanded: Record<string, boolean> = {};

  nodes.forEach((node) => {
    collectExpandedForMatches(node, matchingNodeIds, expanded);
  });

  return expanded;
}
