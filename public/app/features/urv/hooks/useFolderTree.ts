import { useCallback, useEffect, useState } from 'react';

import { FIELD, FOLDER_GROUP_RESOURCE, buildWhere, globalSearch } from '../api/globalSearchApi';

import { type FolderNode, toFolderNode } from './useFolderSidebar';

// The most the server returns per page.
const PAGE_SIZE = 500;
// Stops a huge instance from paging forever; the tree says when it stopped short.
const MAX_FOLDERS = 5000;

interface FolderTreeState {
  folders?: FolderNode[];
  truncated: boolean;
  error?: unknown;
}

/** Every folder the user can see, for "Browse all folders". Only loads while enabled. */
export function useFolderTree(enabled: boolean) {
  const [state, setState] = useState<FolderTreeState>({ truncated: false });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    const loadAll = async () => {
      const folders: FolderNode[] = [];
      let next: string | undefined;
      do {
        const res = await globalSearch({
          where: buildWhere({ types: [FOLDER_GROUP_RESOURCE] }),
          sort: [{ field: FIELD.title, direction: 'asc' }],
          fields: [FIELD.title, FIELD.folder],
          limit: PAGE_SIZE,
          continue: next,
        });
        folders.push(...res.items.map(toFolderNode));
        next = res.metadata.continue;
      } while (next && folders.length < MAX_FOLDERS && !cancelled);
      return { folders, truncated: Boolean(next) };
    };
    loadAll()
      .then((result) => !cancelled && setState(result))
      .catch((error) => !cancelled && setState({ folders: [], truncated: false, error }));
    return () => {
      cancelled = true;
    };
  }, [enabled, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  return { ...state, isLoading: enabled && state.folders === undefined, reload };
}
