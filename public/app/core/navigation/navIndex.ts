import { type NavModelItem } from '@grafana/data';

export interface NavNodeRef {
  node: NavModelItem;
  parentChain: NavModelItem[];
  isTopLevel: boolean;
}

export function buildNavIndex(tree: NavModelItem[]): Map<string, NavNodeRef> {
  const index = new Map<string, NavNodeRef>();

  function walk(nodes: NavModelItem[], parentChain: NavModelItem[], isTopLevel: boolean) {
    for (const node of nodes) {
      const key = getNodeKey(node);
      if (key && !index.has(key)) {
        index.set(key, { node, parentChain, isTopLevel });
      }
      if (node.children?.length) {
        walk(node.children, [...parentChain, node], false);
      }
    }
  }

  walk(tree, [], true);
  return index;
}

export function getNodeKey(node: NavModelItem): string | undefined {
  if (node.id) {
    return node.id;
  }
  if (node.url) {
    return `url:${node.url}`;
  }
  return undefined;
}

export function findById(tree: NavModelItem[], id: string): NavModelItem | null {
  const index = buildNavIndex(tree);
  return index.get(id)?.node ?? null;
}

export function findByUrl(tree: NavModelItem[], url: string): NavModelItem | null {
  for (const item of tree) {
    if (item.url === url) {
      return item;
    }
    if (item.children?.length) {
      const found = findByUrl(item.children, url);
      if (found) {
        return found;
      }
    }
  }
  return null;
}
