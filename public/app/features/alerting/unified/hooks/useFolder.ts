import { useEffect } from 'react';

import { useLazyGetFolderQuery } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { FolderDTO } from 'app/types';

interface ReturnBag {
  folder?: FolderDTO;
  loading: boolean;
}

const PREFER_CACHED_VALUES = true;

/**
 * Returns a folderDTO for the given uid – uses cached values
 * @TODO propagate error state
 */
export function useFolder(uid?: string): ReturnBag {
  const [fetchFolder, fetchFolderState] = useLazyGetFolderQuery();

  useEffect(() => {
    if (uid) {
      fetchFolder(uid, PREFER_CACHED_VALUES);
    }
  }, [fetchFolder, uid]);

  return {
    loading: fetchFolderState.isLoading || fetchFolderState.isUninitialized,
    folder: fetchFolderState.data,
  };
}

export function stringifyFolder({ title, parents }: FolderDTO) {
  return parents && parents?.length
    ? [...parents.map((p) => p.title), title].map(encodeTitle).join('/')
    : encodeTitle(title);
}

export function encodeTitle(title: string): string {
  return title.replaceAll('/', '\\/');
}
