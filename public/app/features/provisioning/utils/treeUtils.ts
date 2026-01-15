import { IconName } from '@grafana/ui';
import { ResourceListItem } from 'app/api/clients/provisioning/v0alpha1';

import { FileDetails, FlatTreeItem, ItemType, SyncStatus, TreeItem } from '../types';

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
  const inferredFolders = new Set<string>();

  for (const file of files) {
    if (isFileDetails(file)) {
      merged.set(file.path, { path: file.path, file });

      // Infer parent folders from file path
      const parts = file.path.split('/');
      for (let i = 1; i < parts.length; i++) {
        inferredFolders.add(parts.slice(0, i).join('/'));
      }
    }
  }

  // Add inferred folders that don't already exist
  for (const folderPath of inferredFolders) {
    if (!merged.has(folderPath)) {
      merged.set(folderPath, { path: folderPath, file: { path: folderPath, hash: '' } });
    }
  }

  // Merge resources
  for (const resource of resources) {
    if (!resource.path) {
      continue;
    }
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
  // Inferred folder (no extension means it's a folder from file paths)
  if (!resource && !path.includes('.')) {
    return 'Folder';
  }
  // Unsynced files are "File" - don't infer Dashboard from .json
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

export function getStatus(fileHash?: string, resourceHash?: string): SyncStatus {
  if (fileHash !== undefined && resourceHash !== undefined) {
    // Empty file hash means inferred folder (synced if resource exists)
    return fileHash === '' || fileHash === resourceHash ? 'synced' : 'pending';
  }
  return 'pending';
}

function calculateFolderStatus(node: TreeItem): SyncStatus | undefined {
  if (node.type !== 'Folder') {
    return node.status;
  }

  // If any child is pending, folder is pending
  for (const child of node.children) {
    const childStatus = child.type === 'Folder' ? calculateFolderStatus(child) : child.status;
    if (childStatus === 'pending') {
      return 'pending';
    }
  }

  return node.status;
}

export function buildTree(mergedItems: MergedItem[]): TreeItem[] {
  const nodeMap = new Map<string, TreeItem>();
  const roots: TreeItem[] = [];

  // Create all nodes (files, dashboards, folders)
  for (const item of mergedItems) {
    const type = getItemType(item.path, item.resource);
    const showStatus = type === 'Dashboard' || type === 'Folder' || item.path.endsWith('.json');

    nodeMap.set(item.path, {
      path: item.path,
      title: getDisplayTitle(item.path, item.resource),
      type,
      level: 0,
      children: [],
      resourceName: item.resource?.name,
      hash: item.file?.hash ?? item.resource?.hash,
      status: showStatus ? getStatus(item.file?.hash, item.resource?.hash) : undefined,
      hasFile: !!item.file,
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

  // Sort: folders first, then alphabetically, recursively
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
      sortNodes(node.children);
    }
  };

  sortNodes(roots);

  // Update folder statuses recursively (folders inherit pending from children)
  const updateFolderStatus = (nodes: TreeItem[]) => {
    for (const node of nodes) {
      if (node.type === 'Folder') {
        updateFolderStatus(node.children);
        node.status = calculateFolderStatus(node);
      }
    }
  };

  updateFolderStatus(roots);
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
    const matches = node.path.toLowerCase().includes(lowerQuery) || node.title.toLowerCase().includes(lowerQuery);

    if (matches) {
      return node;
    }

    if (node.type === 'Folder' && node.children.length > 0) {
      const filteredChildren = node.children.map(filterNode).filter((n): n is TreeItem => n !== null);
      return filteredChildren.length > 0 ? { ...node, children: filteredChildren } : null;
    }

    return null;
  };

  return items.map(filterNode).filter((n): n is TreeItem => n !== null);
}
