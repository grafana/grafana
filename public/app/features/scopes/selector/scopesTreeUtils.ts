import { ScopeNode } from '@grafana/data';

import { NodesMap, TreeNode } from './types';

/**
 * Creates a deep copy of the node tree with expanded prop set to false.
 */
export function closeNodes(tree: TreeNode): TreeNode {
  const node = { ...tree };
  node.expanded = false;
  if (node.children) {
    node.children = { ...node.children };
    for (const key of Object.keys(node.children)) {
      node.children[key] = closeNodes(node.children[key]);
    }
  }
  return node;
}

export function expandNodes(tree: TreeNode, path: string[]): TreeNode {
  let newTree = { ...tree };
  let currentTree = newTree;
  currentTree.expanded = true;
  // Remove the root segment
  const newPath = path.slice(1);

  for (const segment of newPath) {
    const node = currentTree.children?.[segment];
    if (!node) {
      throw new Error(`Node ${segment} not found in tree`);
    }

    const newNode = { ...node };
    currentTree.children = { ...currentTree.children };
    currentTree.children[segment] = newNode;
    newNode.expanded = true;
    currentTree = newNode;
  }

  return newTree;
}

export function isNodeExpandable(node: ScopeNode) {
  return node.spec.nodeType === 'container';
}

export function isNodeSelectable(node: ScopeNode) {
  return node.spec.linkType === 'scope';
}

export function getPathOfNode(scopeNodeId: string, nodes: NodesMap): string[] {
  if (scopeNodeId === '') {
    return [''];
  }
  const path = [scopeNodeId];
  let parent = nodes[scopeNodeId]?.spec.parentName;
  while (parent) {
    path.unshift(parent);
    parent = nodes[parent]?.spec.parentName;
  }
  path.unshift('');
  return path;
}

export function modifyTreeNodeAtPath(tree: TreeNode, path: string[], modifier: (treeNode: TreeNode) => void) {
  if (path.length < 1) {
    return tree;
  }

  const newTree = { ...tree };
  let currentNode = newTree;

  if (path.length === 1 && path[0] === '') {
    modifier(currentNode);
    return newTree;
  }

  for (const section of path.slice(1)) {
    if (!currentNode.children?.[section]) {
      return newTree;
    }

    currentNode.children = { ...currentNode.children };
    currentNode.children[section] = { ...currentNode.children[section] };
    currentNode = currentNode.children[section];
  }

  modifier(currentNode);
  return newTree;
}

export function treeNodeAtPath(tree: TreeNode, path: string[]) {
  if (path.length < 1) {
    return undefined;
  }

  if (path.length === 1 && path[0] === '') {
    return tree;
  }

  let treeNode: TreeNode | undefined = tree;

  for (const section of path.slice(1)) {
    treeNode = treeNode.children?.[section];
    if (!treeNode) {
      return undefined;
    }
  }

  return treeNode;
}
