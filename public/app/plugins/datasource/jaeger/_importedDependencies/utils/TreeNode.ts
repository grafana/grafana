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
// limitations under the License

export default class TreeNode<TValue> {
  value: TValue;
  children: Array<TreeNode<TValue>>;

  static iterFunction<TValue>(
    fn: ((value: TValue, node: TreeNode<TValue>, depth: number) => TreeNode<TValue> | null) | Function,
    depth = 0
  ) {
    return (node: TreeNode<TValue>) => fn(node.value, node, depth);
  }

  static searchFunction<TValue>(search: Function | TreeNode<TValue>) {
    if (typeof search === 'function') {
      return search;
    }

    return (value: TValue, node: TreeNode<TValue>) => (search instanceof TreeNode ? node === search : value === search);
  }

  constructor(value: TValue, children: Array<TreeNode<TValue>> = []) {
    this.value = value;
    this.children = children;
  }

  get depth(): number {
    return this.children.reduce((depth, child) => Math.max(child.depth + 1, depth), 1);
  }

  get size() {
    let i = 0;
    this.walk(() => i++);
    return i;
  }

  addChild(child: TreeNode<TValue> | TValue) {
    this.children.push(child instanceof TreeNode ? child : new TreeNode(child));
    return this;
  }

  find(search: Function | TreeNode<TValue>): TreeNode<TValue> | null {
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

  getPath(search: Function | TreeNode<TValue>) {
    const searchFn = TreeNode.iterFunction(TreeNode.searchFunction(search));

    const findPath = (
      currentNode: TreeNode<TValue>,
      currentPath: Array<TreeNode<TValue>>
    ): Array<TreeNode<TValue>> | null => {
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

  walk(fn: (spanID: TValue, node: TreeNode<TValue>, depth: number) => void, startDepth = 0) {
    type StackEntry = {
      node: TreeNode<TValue>;
      depth: number;
    };
    const nodeStack: StackEntry[] = [];
    let actualDepth = startDepth;
    nodeStack.push({ node: this, depth: actualDepth });
    while (nodeStack.length) {
      const entry: StackEntry = nodeStack[nodeStack.length - 1];
      nodeStack.pop();
      const { node, depth } = entry;
      fn(node.value, node, depth);
      actualDepth = depth + 1;
      let i = node.children.length - 1;
      while (i >= 0) {
        nodeStack.push({ node: node.children[i], depth: actualDepth });
        i--;
      }
    }
  }

  paths(fn: (pathIds: TValue[]) => void) {
    type StackEntry = {
      node: TreeNode<TValue>;
      childIndex: number;
    };
    const stack: StackEntry[] = [];
    stack.push({ node: this, childIndex: 0 });
    const paths: TValue[] = [];
    while (stack.length) {
      const { node, childIndex } = stack[stack.length - 1];
      if (node.children.length >= childIndex + 1) {
        stack[stack.length - 1].childIndex++;
        stack.push({ node: node.children[childIndex], childIndex: 0 });
      } else {
        if (node.children.length === 0) {
          const path = stack.map((item) => item.node.value);
          fn(path);
        }
        stack.pop();
      }
    }
    return paths;
  }
}
