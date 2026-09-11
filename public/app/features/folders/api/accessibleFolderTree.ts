import { getFolderAPIBaseURL } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { getBackendSrv } from '@grafana/runtime';
export type FolderNavigationPurpose = 'browse' | 'dashboard-create' | 'folder-edit' | 'folder-admin';
export type FolderNavigationAccess = 'full' | 'ancestor' | 'navigation';

export interface FolderNavigationItem {
  uid: string;
  title: string;
  kind: 'folder' | 'virtual';
  navigationParentUid?: string;
  access: FolderNavigationAccess;
  selectable: boolean;
}

interface FolderNavigationResponse {
  items: FolderNavigationItem[];
}

export interface FolderNavigationIndex {
  byUID: Map<string, FolderNavigationItem>;
  childrenByParent: Map<string | undefined, FolderNavigationItem[]>;
}

const CACHE_TTL_MS = 10_000;
const cache = new Map<string, { expires: number; request: Promise<FolderNavigationItem[]> }>();

export async function getFolderNavigationTree(purpose: FolderNavigationPurpose = 'browse') {
  const baseURL = await getFolderAPIBaseURL();
  const cacheKey = `${baseURL}:${purpose}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.request;
  }

  const request = getBackendSrv()
    .get<FolderNavigationResponse>(`${baseURL}/folders/general/tree`, { purpose }, undefined, {
      showErrorAlert: false,
    })
    .then((response) => response.items);
  cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, request });
  request.catch(() => cache.delete(cacheKey));
  return request;
}

export function invalidateFolderNavigationTree() {
  cache.clear();
}

// Keep mutation callers source-compatible while the navigation service name is rolled out.
export const invalidateAccessibleFolderTree = invalidateFolderNavigationTree;

export function buildFolderNavigationIndex(items: FolderNavigationItem[]): FolderNavigationIndex {
  const byUID = new Map<string, FolderNavigationItem>();
  const childrenByParent = new Map<string | undefined, FolderNavigationItem[]>();
  for (const item of items) {
    byUID.set(item.uid, item);
    const parent = item.navigationParentUid || undefined;
    childrenByParent.set(parent, [...(childrenByParent.get(parent) ?? []), item]);
  }
  return { byUID, childrenByParent };
}

export async function getFolderNavigationChildren(
  parentUID: string | undefined,
  purpose: FolderNavigationPurpose,
  page: number,
  pageSize: number
) {
  const index = buildFolderNavigationIndex(await getFolderNavigationTree(purpose));
  const children = index.childrenByParent.get(parentUID) ?? [];
  const start = Math.max(0, page - 1) * pageSize;
  return children.slice(start, start + pageSize);
}
