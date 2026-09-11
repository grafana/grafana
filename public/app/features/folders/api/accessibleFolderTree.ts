import { getFolderAPIBaseURL } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { getBackendSrv } from '@grafana/runtime';
import { type PermissionLevel } from 'app/types/acl';

export interface AccessibleFolderTreeItem {
  name: string;
  title: string;
  parent?: string;
  access: 'full' | 'ancestor';
}

interface AccessibleFolderTreeResponse {
  items: AccessibleFolderTreeItem[];
}

const CACHE_TTL_MS = 10_000;
const cache = new Map<string, { expires: number; request: Promise<AccessibleFolderTreeItem[]> }>();

export async function getAccessibleFolderTree(permission: PermissionLevel = 'view') {
  const baseURL = await getFolderAPIBaseURL();
  const cacheKey = `${baseURL}:${permission}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.request;
  }

  const request = getBackendSrv()
    .get<AccessibleFolderTreeResponse>(`${baseURL}/folders/general/tree`, { permission }, undefined, {
      showErrorAlert: false,
    })
    .then((response) => response.items);
  cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, request });
  request.catch(() => cache.delete(cacheKey));
  return request;
}

export function invalidateAccessibleFolderTree() {
  cache.clear();
}

export async function getAccessibleFolderChildren(
  parentUID: string | undefined,
  permission: PermissionLevel,
  page: number,
  pageSize: number
) {
  const tree = await getAccessibleFolderTree(permission);
  const children = tree.filter((item) => (item.parent || undefined) === parentUID);
  const start = Math.max(0, page - 1) * pageSize;
  return children.slice(start, start + pageSize);
}
