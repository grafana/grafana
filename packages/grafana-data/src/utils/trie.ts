/**
 * Modified from the MIT licensed project:
 * https://github.com/chriswheeldon/trie.ts/blob/master/src/index.ts
 */

class trie_node<T> {
  terminal: boolean;
  value: T;
  children: Map<string, trie_node<T>>;

  constructor() {
    this.terminal = false;
    this.children = new Map();
    this.value = (undefined as unknown) as T; // simlifies internal typing
  }
}

export class Trie<T> {
  private root: trie_node<T>;
  private elements: number;

  constructor(rootValue?: T) {
    this.root = new trie_node<T>();
    this.root.value = rootValue!;
    this.elements = 0;
  }

  get length(): number {
    return this.elements;
  }

  get(key: string): T | undefined {
    const node = this.getNode(key);
    if (node) {
      return node.value;
    }
    return undefined;
  }

  contains(key: string): boolean {
    const node = this.getNode(key);
    return !!node;
  }

  insert(key: string, value: T): void {
    let node = this.root;
    let remaining = key;
    while (remaining.length > 0) {
      let child: trie_node<T> | undefined;
      for (const childKey of node.children.keys()) {
        const prefix = this.commonPrefix(remaining, childKey);
        if (!prefix.length) {
          continue;
        }
        if (prefix.length === childKey.length) {
          // enter child node
          child = node.children.get(childKey);
          remaining = remaining.slice(childKey.length);
          break;
        } else {
          // split the child
          child = new trie_node<T>();
          child.children.set(childKey.slice(prefix.length), node.children.get(childKey)!);
          node.children.delete(childKey);
          node.children.set(prefix, child);
          remaining = remaining.slice(prefix.length);
          break;
        }
      }
      if (!child && remaining.length) {
        child = new trie_node<T>();
        node.children.set(remaining, child);
        remaining = '';
      }
      node = child!;
    }
    if (!node.terminal) {
      node.terminal = true;
      this.elements += 1;
    }
    node.value = value;
  }

  remove(key: string): void {
    const node = this.getNode(key);
    if (node) {
      node.terminal = false;
      this.elements -= 1;
    }
  }

  /**
   * Finds the value with a matching prefix
   */
  find(key: string): T | undefined {
    let node = this.root;
    let remaining = key;
    let last: T | undefined;
    while (node && remaining.length > 0) {
      let child: trie_node<T> | undefined;
      for (let i = 1; i <= remaining.length; i += 1) {
        child = node.children.get(remaining.slice(0, i));
        if (child) {
          remaining = remaining.slice(i);
          if (child.value !== undefined) {
            last = child.value;
          }
          break;
        }
      }
      node = child!;
    }
    return last;
  }

  private getNode(key: string): trie_node<T> | undefined {
    let node = this.root;
    let remaining = key;
    while (node && remaining.length > 0) {
      let child: trie_node<T> | undefined;
      for (let i = 1; i <= remaining.length; i += 1) {
        child = node.children.get(remaining.slice(0, i));
        if (child) {
          remaining = remaining.slice(i);
          break;
        }
      }
      node = child!;
    }
    return remaining.length === 0 && node && node.terminal ? node : undefined;
  }

  private commonPrefix(a: string, b: string): string {
    const shortest = Math.min(a.length, b.length);
    let i = 0;
    for (; i < shortest; i += 1) {
      if (a[i] !== b[i]) {
        break;
      }
    }
    return a.slice(0, i);
  }

  /**
   * Calculates a list of all keys.  This is a relativly slow operation
   */
  getKeys(): string[] {
    const keys: string[] = [];
    this.addKeys('', this.root, keys);
    return keys;
  }

  private addKeys(pfix: string, node: trie_node<T>, keys: string[]) {
    if (node.terminal && node.value !== undefined) {
      keys.push(pfix);
    }
    for (const key of node.children.keys()) {
      this.addKeys(pfix + key, node.children.get(key)!, keys);
    }
  }
}
