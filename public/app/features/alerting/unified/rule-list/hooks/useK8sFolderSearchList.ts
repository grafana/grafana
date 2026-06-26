import { useListFolderQuery } from 'app/api/clients/folder/v1beta1';

import { type FolderNode } from './useFolderTreeModel';

// Folders LIST returns the whole (visible) set; for the PoC we page generously and match titles
// client-side (substring), since the server-side spec.title selector is equality-only.
const SEARCH_LIST_LIMIT = 1000;

export interface UseK8sFolderSearchListResult {
  folders: FolderNode[];
  isLoading: boolean;
  error: unknown;
}

/**
 * Flat folder list filtered by title, used when a folder/namespace filter is active. Returns the
 * matching folders (flattened, no hierarchy) for the tree model to render as a flat result set.
 */
export function useK8sFolderSearchList(titleFilter: string, enabled = true): UseK8sFolderSearchListResult {
  const { data, isLoading, error } = useListFolderQuery({ limit: SEARCH_LIST_LIMIT }, { skip: !enabled });

  const needle = titleFilter.trim().toLowerCase();
  const folders: FolderNode[] = (data?.items ?? [])
    .map((folder) => ({
      uid: folder.metadata?.name ?? '',
      title: folder.spec?.title ?? '',
      parentUid: folder.metadata?.annotations?.['grafana.app/folder'] || undefined,
    }))
    .filter((folder) => folder.uid && folder.title.toLowerCase().includes(needle));

  return { folders, isLoading, error };
}
