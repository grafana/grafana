import { TreeNode } from '../types';

export function calcLevel<T extends TreeNode<T>>(node: T) {
  let level = 0;
  let parent = node.parent;
  while (parent) {
    level++;
    parent = parent.parent;
  }
  return level;
}

export function iterTree<T extends TreeNode<T>>(nodes: T[], fn: (node: T) => void): void {
  nodes.forEach((node) => {
    fn(node);
    iterTree(node.children, fn);
  });
}

export function mapTree<T extends { parent?: T; children: T[] }, R>(nodes: T[], fn: (node: T) => R): R[] {
  const acc: R[] = [];
  iterTree(nodes, (operation) => {
    acc.push(fn(operation));
  });
  return acc;
}
