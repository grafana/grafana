import { type KindInfo } from '@grafana/runtime/unstable';
import { type IconName } from '@grafana/ui';
import { type ResourceListItem } from 'app/api/clients/provisioning/v0alpha1';
import { CORE_KINDS, findKindByResource } from 'app/core/kinds/coreKinds';

import { type FileDetails, type FlatTreeItem, type SyncStatus, type TreeItem } from '../types';

import { getFolderMetadataPath, getParentFolderResourceHash, isFolderMetadataPath } from './folderMetadata';

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
    const path = resource.path.replace(/\/+$/, '');
    if (!path && findKindByResource(resource.group, resource.resource) !== CORE_KINDS.folder) {
      continue;
    }
    const existing = merged.get(path);
    if (existing) {
      existing.resource = resource;
    } else {
      merged.set(path, { path, resource });
    }
  }

  return Array.from(merged.values());
}

/** The kind of a tree item, or undefined for a plain file. */
export function getTreeItemKind(path: string, resource?: ResourceListItem): KindInfo | undefined {
  if (resource) {
    return findKindByResource(resource.group, resource.resource);
  }
  // Inferred folder (no extension means it's a folder from file paths). Unsynced files stay plain
  // files: don't infer Dashboard from .json
  return path.includes('.') ? undefined : CORE_KINDS.folder;
}

function isFolder(node: TreeItem): boolean {
  return node.kind === CORE_KINDS.folder;
}

function getDisplayTitle(path: string, resource?: ResourceListItem): string {
  if (resource?.title) {
    return resource.title;
  }
  return path.split('/').pop() ?? path;
}

export function getIconName({ kind }: Pick<TreeItem, 'kind'>): IconName {
  return kind?.icon ?? 'file-alt';
}

export function getStatus(fileHash?: string, resourceHash?: string): SyncStatus {
  if (fileHash !== undefined && resourceHash !== undefined) {
    // Empty file hash means inferred folder (synced if resource exists)
    return fileHash === '' || fileHash === resourceHash ? 'synced' : 'pending';
  }
  return 'pending';
}

function calculateFolderStatus(node: TreeItem): SyncStatus | undefined {
  if (!isFolder(node)) {
    return node.status;
  }

  // If any child is pending, folder is pending.
  for (const child of node.children) {
    const childStatus = isFolder(child) ? calculateFolderStatus(child) : child.status;
    if (childStatus === 'pending') {
      return 'pending';
    }
  }

  return node.status;
}

export function buildTree(mergedItems: MergedItem[]): TreeItem[] {
  const nodeMap = new Map<string, TreeItem>();
  const roots: TreeItem[] = [];
  const mergedByPath = new Map(mergedItems.map((item) => [item.path, item]));
  const lookupResourceHash = (path: string) => mergedByPath.get(path)?.resource?.hash;

  // Create all nodes (files, dashboards, folders)
  for (const item of mergedItems) {
    const kind =
      !item.resource && item.file?.hash === '' ? CORE_KINDS.folder : getTreeItemKind(item.path, item.resource);
    const isFolderMetadata = isFolderMetadataPath(item.path);
    // Show sync status for any provisioned resource kind (Folder, Dashboard, Playlist, ...) or for
    // unsynced .json files that haven't been turned into a resource yet. `kind` is only unset for
    // paths that don't map to a kind in the kind registry.
    const showStatus = kind !== undefined || item.path.endsWith('.json');
    const resourceHash = isFolderMetadata
      ? getParentFolderResourceHash(item.path, lookupResourceHash)
      : item.resource?.hash;

    nodeMap.set(item.path, {
      path: item.path,
      title: getDisplayTitle(item.path, item.resource),
      type: kind?.kind ?? 'File',
      kind,
      level: 0,
      children: [],
      resourceName: item.resource?.name,
      resource: item.resource?.resource,
      hash: item.file?.hash ?? item.resource?.hash,
      status: !item.path ? 'synced' : showStatus ? getStatus(item.file?.hash, resourceHash) : undefined,
      hasFile: !!item.file,
    });
  }

  // Detect provisioned folders missing _folder.json metadata. If the folder resource
  // has a non-empty hash, the metadata was previously synced — its absence means the
  // file was removed from the remote repo, so the folder is pending until the next sync.
  for (const [path, node] of nodeMap) {
    if (path && isFolder(node) && node.resourceName) {
      const metadataPath = getFolderMetadataPath(path);
      const fileExists = nodeMap.has(metadataPath);
      node.missingFolderMetadata = !fileExists;
      if (!fileExists && mergedByPath.get(path)?.resource?.hash) {
        node.status = 'pending';
      }
    }
  }

  for (const [path, node] of nodeMap) {
    if (!isFolderMetadataPath(path)) {
      continue;
    }
    nodeMap.delete(path);
    const parent = path.includes('/') ? nodeMap.get(path.substring(0, path.lastIndexOf('/'))) : undefined;
    if (parent) {
      parent.metadataPath = path;
      if (node.status === 'pending') {
        parent.status = 'pending';
      }
    }
  }

  // Build parent-child relationships
  for (const [path, node] of nodeMap) {
    const parentPath = path.substring(0, Math.max(path.lastIndexOf('/'), 0));
    const parent = path ? (nodeMap.get(parentPath) ?? nodeMap.get('')) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort: folders first, then alphabetically, recursively
  const sortNodes = (nodes: TreeItem[]) => {
    nodes.sort((a, b) => {
      if (isFolder(a) && !isFolder(b)) {
        return -1;
      }
      if (!isFolder(a) && isFolder(b)) {
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
      if (isFolder(node)) {
        updateFolderStatus(node.children);
        node.status = calculateFolderStatus(node);
      }
    }
  };

  updateFolderStatus(roots);
  return roots;
}

/**
 * Flatten a tree into the ordered list the table renders. A folder's descendants are only
 * included when it is expanded. `expandedPaths` holds the set of folder paths currently expanded;
 * pass `undefined` to expand everything (e.g. while searching, so all matches stay visible).
 */
export function flattenTree(items: TreeItem[], expandedPaths?: Set<string>, level = 0): FlatTreeItem[] {
  const result: FlatTreeItem[] = [];

  for (const item of items) {
    const isExpandable = item.children.length > 0;
    const isExpanded = isExpandable && (!expandedPaths || expandedPaths.has(item.path));

    result.push({
      item: { ...item, level },
      level,
      isExpandable,
      isExpanded,
    });

    if (isExpanded) {
      result.push(...flattenTree(item.children, expandedPaths, level + 1));
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

    if (isFolder(node) && node.children.length > 0) {
      const filteredChildren = node.children.map(filterNode).filter((n): n is TreeItem => n !== null);
      return filteredChildren.length > 0 ? { ...node, children: filteredChildren } : null;
    }

    return null;
  };

  return items.map(filterNode).filter((n): n is TreeItem => n !== null);
}

/**
 * A tree item's status as shown in the Resources tab. `warning` mirrors the folder
 * metadata warning icon, which takes precedence over the sync icons. This is the single
 * source of truth shared by the status cell and the status filter so they never drift.
 */
export type StatusCategory = 'warning' | 'pending' | 'synced';

export function getStatusCategory(node: TreeItem): StatusCategory | undefined {
  if (node.missingFolderMetadata) {
    return 'warning';
  }
  return node.status;
}

/**
 * Filter tree to items whose status is in `categories` and whose plural resource name (e.g.
 * `dashboards`) is in `resources`, keeping ancestor folders so the hierarchy stays intact. An
 * empty list disables that filter.
 */
export function filterByStatusAndResources(
  items: TreeItem[],
  categories: StatusCategory[],
  resources: string[]
): TreeItem[] {
  if (categories.length === 0 && resources.length === 0) {
    return items;
  }

  const selectedCategories = new Set(categories);
  const selectedResources = new Set(resources);
  const matches = (node: TreeItem): boolean => {
    const category = getStatusCategory(node);
    const matchesStatus = selectedCategories.size === 0 || (category !== undefined && selectedCategories.has(category));
    const matchesResource =
      selectedResources.size === 0 || (node.resource !== undefined && selectedResources.has(node.resource));
    return matchesStatus && matchesResource;
  };

  const filterNode = (node: TreeItem): TreeItem | null => {
    if (isFolder(node) && node.children.length > 0) {
      const filteredChildren = node.children.map(filterNode).filter((n): n is TreeItem => n !== null);
      if (filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      // No matching descendants — keep the folder only if it matches itself.
      return matches(node) ? { ...node, children: [] } : null;
    }

    return matches(node) ? node : null;
  };

  return items.map(filterNode).filter((n): n is TreeItem => n !== null);
}
