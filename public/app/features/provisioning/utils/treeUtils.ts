import { IconName } from '@grafana/ui';
import { ResourceListItem } from 'app/api/clients/provisioning/v0alpha1';

import { FileDetails, FlatTreeItem, ItemType, TreeItem } from '../types';

interface MergedItem {
  path: string;
  file?: FileDetails;
  resource?: ResourceListItem;
}

/**
 * Type guard to check if an object is a FileDetails
 */
function isFileDetails(obj: unknown): obj is FileDetails {
  return typeof obj === 'object' && obj !== null && 'path' in obj && 'hash' in obj;
}

/**
 * Merge files and resources by path into a single list
 */
export function mergeFilesAndResources(files: unknown[], resources: ResourceListItem[]): MergedItem[] {
  const merged = new Map<string, MergedItem>();

  // Add all files (with type guard)
  for (const file of files) {
    if (isFileDetails(file)) {
      merged.set(file.path, { path: file.path, file });
    }
  }

  // Merge resources
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

/**
 * Determine the item type based on path and resource info
 */
export function getItemType(path: string, resource?: ResourceListItem): ItemType {
  if (resource?.resource === 'dashboards') {
    return 'Dashboard';
  }
  if (resource?.resource === 'folders') {
    return 'Folder';
  }
  // Check if it's a folder based on whether it has children (handled in buildTree)
  // For now, treat as File
  return 'File';
}

/**
 * Get display title from path or resource title
 */
export function getDisplayTitle(path: string, resource?: ResourceListItem): string {
  // If resource has a title, use it
  if (resource?.title) {
    return resource.title;
  }
  // Otherwise use the last segment of the path
  return path.split('/').pop() ?? path;
}

/**
 * Get icon name based on item type
 */
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

/**
 * Build a hierarchical tree from merged items
 */
export function buildTree(mergedItems: MergedItem[]): TreeItem[] {
  const nodeMap = new Map<string, TreeItem>();
  const roots: TreeItem[] = [];

  // First pass: collect all folder paths that need to be created
  const folderPaths = new Set<string>();
  for (const item of mergedItems) {
    const parts = item.path.split('/');
    // Add all parent folders
    for (let i = 1; i < parts.length; i++) {
      folderPaths.add(parts.slice(0, i).join('/'));
    }
  }

  // Create folder nodes
  for (const folderPath of folderPaths) {
    // Check if this folder is also in our merged items (e.g., a folder resource)
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

  // Second pass: create file/dashboard nodes
  for (const item of mergedItems) {
    // Skip if it's already a folder
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

  // Third pass: build parent-child relationships
  for (const [path, node] of nodeMap) {
    const lastSlashIndex = path.lastIndexOf('/');
    if (lastSlashIndex === -1) {
      // Root level item
      roots.push(node);
    } else {
      const parentPath = path.substring(0, lastSlashIndex);
      const parent = nodeMap.get(parentPath);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent doesn't exist, add to roots
        roots.push(node);
      }
    }
  }

  // Sort children: folders first, then alphabetically
  const sortNodes = (nodes: TreeItem[]) => {
    nodes.sort((a, b) => {
      // Folders come first
      if (a.type === 'Folder' && b.type !== 'Folder') {
        return -1;
      }
      if (a.type !== 'Folder' && b.type === 'Folder') {
        return 1;
      }
      // Then sort alphabetically by title
      // eslint-disable-next-line no-restricted-syntax
      return a.title.localeCompare(b.title);
    });
    // Recursively sort children
    for (const node of nodes) {
      if (node.children.length > 0) {
        sortNodes(node.children);
      }
    }
  };

  sortNodes(roots);
  return roots;
}

/**
 * Flatten tree for rendering (always expanded)
 */
export function flattenTree(items: TreeItem[], level = 0): FlatTreeItem[] {
  const result: FlatTreeItem[] = [];

  for (const item of items) {
    result.push({
      item: { ...item, level },
      level,
    });

    // Always expand - add children
    if (item.children.length > 0) {
      result.push(...flattenTree(item.children, level + 1));
    }
  }

  return result;
}

/**
 * Filter tree by search query (searches path and title)
 * Returns filtered tree including ancestor folders for matching items
 */
export function filterTree(items: TreeItem[], searchQuery: string): TreeItem[] {
  if (!searchQuery) {
    return items;
  }

  const lowerQuery = searchQuery.toLowerCase();

  const filterNode = (node: TreeItem): TreeItem | null => {
    const matchesPath = node.path.toLowerCase().includes(lowerQuery);
    const matchesTitle = node.title.toLowerCase().includes(lowerQuery);

    // If this node matches, return it with all its children
    if (matchesPath || matchesTitle) {
      return node;
    }

    // If this is a folder, check if any children match
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
