import { IconName } from '@grafana/ui';
import { ResourceListItem } from 'app/api/clients/provisioning/v0alpha1';

import { FileDetails, FlatTreeItem, ItemType, TreeItem } from '../types';

const collator = new Intl.Collator();

interface MergedItem {
  path: string;
  file?: FileDetails;
  resource?: ResourceListItem;
}

function isFileDetails(obj: unknown): obj is FileDetails {
  return typeof obj === 'object' && obj !== null && 'path' in obj && 'hash' in obj;
}

export function mergeFilesAndResources(files: unknown[], resources: ResourceListItem[]): MergedItem[] {
  const merged = new Map<string, MergedItem>();

  for (const file of files) {
    if (isFileDetails(file)) {
      merged.set(file.path, { path: file.path, file });
    }
  }

  for (const resource of resources) {
    const existing = merged.get(resource.path);
    if (existing) {
      existing.resource = resource;
    } else {
      merged.set(resource.path, { path: resource.path, resource });
    }
  }

  return Array.from(merged.values());
}

export function getItemType(path: string, resource?: ResourceListItem): ItemType {
  if (resource?.resource === 'dashboards') {
    return 'Dashboard';
  }
  if (resource?.resource === 'folders') {
    return 'Folder';
  }
  return 'File';
}

export function getDisplayTitle(path: string, resource?: ResourceListItem): string {
  if (resource?.title) {
    return resource.title;
  }
  return path.split('/').pop() ?? path;
}

export function getIconName(type: ItemType): IconName {
  switch (type) {
    case 'Folder':
      return 'folder';
    case 'Dashboard':
      return 'apps';
    case 'File':
    default:
      return 'file-alt';
  }
}

export function buildTree(mergedItems: MergedItem[]): TreeItem[] {
  const nodeMap = new Map<string, TreeItem>();
  const roots: TreeItem[] = [];

  // Collect all folder paths that need to be created
  const folderPaths = new Set<string>();
  for (const item of mergedItems) {
    const parts = item.path.split('/');
    for (let i = 1; i < parts.length; i++) {
      folderPaths.add(parts.slice(0, i).join('/'));
    }
  }

  // Create folder nodes
  for (const folderPath of folderPaths) {
    const existingItem = mergedItems.find((m) => m.path === folderPath);

    nodeMap.set(folderPath, {
      path: folderPath,
      title: getDisplayTitle(folderPath, existingItem?.resource),
      type: 'Folder',
      level: 0,
      children: [],
      resourceName: existingItem?.resource?.name,
      hash: existingItem?.file?.hash ?? existingItem?.resource?.hash,
    });
  }

  // Create file/dashboard nodes
  for (const item of mergedItems) {
    if (folderPaths.has(item.path)) {
      continue;
    }

    const type = getItemType(item.path, item.resource);
    nodeMap.set(item.path, {
      path: item.path,
      title: getDisplayTitle(item.path, item.resource),
      type,
      level: 0,
      children: [],
      resourceName: item.resource?.name,
      hash: item.file?.hash ?? item.resource?.hash,
    });
  }

  // Build parent-child relationships
  for (const [path, node] of nodeMap) {
    const lastSlashIndex = path.lastIndexOf('/');
    if (lastSlashIndex === -1) {
      roots.push(node);
    } else {
      const parentPath = path.substring(0, lastSlashIndex);
      const parent = nodeMap.get(parentPath);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  }

  // Sort: folders first, then alphabetically
  const sortNodes = (nodes: TreeItem[]) => {
    nodes.sort((a, b) => {
      if (a.type === 'Folder' && b.type !== 'Folder') {
        return -1;
      }
      if (a.type !== 'Folder' && b.type === 'Folder') {
        return 1;
      }
      return collator.compare(a.title, b.title);
    });
    for (const node of nodes) {
      if (node.children.length > 0) {
        sortNodes(node.children);
      }
    }
  };

  sortNodes(roots);
  return roots;
}

export function flattenTree(items: TreeItem[], level = 0): FlatTreeItem[] {
  const result: FlatTreeItem[] = [];

  for (const item of items) {
    result.push({
      item: { ...item, level },
      level,
    });

    if (item.children.length > 0) {
      result.push(...flattenTree(item.children, level + 1));
    }
  }

  return result;
}

/**
 * Filter tree by search query (searches path and title).
 * Returns filtered tree including ancestor folders for matching items.
 */
export function filterTree(items: TreeItem[], searchQuery: string): TreeItem[] {
  if (!searchQuery) {
    return items;
  }

  const lowerQuery = searchQuery.toLowerCase();

  const filterNode = (node: TreeItem): TreeItem | null => {
    const matchesPath = node.path.toLowerCase().includes(lowerQuery);
    const matchesTitle = node.title.toLowerCase().includes(lowerQuery);

    if (matchesPath || matchesTitle) {
      return node;
    }

    if (node.type === 'Folder' && node.children.length > 0) {
      const filteredChildren = node.children.map(filterNode).filter((n): n is TreeItem => n !== null);

      if (filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
    }

    return null;
  };

  return items.map(filterNode).filter((n): n is TreeItem => n !== null);
}
