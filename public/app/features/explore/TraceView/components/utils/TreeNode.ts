// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

type SearchFn = (value: string | number | undefined, node: TreeNode, depth?: number) => boolean;

export default class TreeNode {
  value: string | number | undefined;
  children: TreeNode[];

  static iterFunction(fn: SearchFn, depth = 0) {
    return (node: TreeNode) => fn(node.value, node, depth);
  }

  static searchFunction(search: TreeNode | number | SearchFn | string) {
    if (typeof search === 'function') {
      return search;
    }

    return (value: string | number | undefined, node: TreeNode) =>
      search instanceof TreeNode ? node === search : value === search;
  }

  constructor(value?: string | number, children: TreeNode[] = []) {
    this.value = value;
    this.children = children;
  }

  get depth(): number {
    return this.children?.reduce((depth: number, child: { depth: number }) => Math.max(child.depth + 1, depth), 1);
  }

  get size() {
    let i = 0;
    this.walk(() => i++);
    return i;
  }

  addChild(child: string | number | TreeNode) {
    this.children?.push(child instanceof TreeNode ? child : new TreeNode(child));
    return this;
  }

  find(search: TreeNode | number | SearchFn | string): TreeNode | null {
    const searchFn = TreeNode.iterFunction(TreeNode.searchFunction(search));
    if (searchFn(this)) {
      return this;
    }
    for (let i = 0; i < this.children.length; i++) {
      const result = this.children[i].find(search);
      if (result) {
        return result;
      }
    }
    return null;
  }

  getPath(search: TreeNode | string) {
    const searchFn = TreeNode.iterFunction(TreeNode.searchFunction(search));

    const findPath = (currentNode: TreeNode, currentPath: TreeNode[]): TreeNode[] | null => {
      // skip if we already found the result
      const attempt = currentPath.concat([currentNode]);
      // base case: return the array when there is a match
      if (searchFn(currentNode)) {
        return attempt;
      }
      for (let i = 0; i < currentNode.children.length; i++) {
        const child = currentNode.children[i];
        const match = findPath(child, attempt);
        if (match) {
          return match;
        }
      }
      return null;
    };

    return findPath(this, []);
  }

  walk(fn: (value: string | number | undefined, node: TreeNode, depth?: number) => void, depth = 0) {
    const nodeStack: Array<{ node: TreeNode; depth?: number }> = [];
    let actualDepth = depth;
    nodeStack.push({ node: this, depth: actualDepth });
    while (nodeStack.length) {
      const popped = nodeStack.pop();
      if (popped) {
        const { node, depth: nodeDepth } = popped;
        fn(node.value, node, nodeDepth);
        actualDepth = (nodeDepth || 0) + 1;
        let i = node.children.length - 1;
        while (i >= 0) {
          nodeStack.push({ node: node.children[i], depth: actualDepth });
          i--;
        }
      }
    }
  }
}
