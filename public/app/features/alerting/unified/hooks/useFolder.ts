import { skipToken } from '@reduxjs/toolkit/query/react';

import { useGetFolderQuery } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { FolderDTO } from 'app/types/folders';

interface ReturnBag {
  folder?: FolderDTO;
  loading: boolean;
}

/**
 * Returns a folderDTO for the given uid – uses cached values
 * @TODO propagate error state
 */
export function useFolder(uid?: string): ReturnBag {
  const fetchFolderState = useGetFolderQuery(uid || skipToken);

  return {
    loading: fetchFolderState.isLoading,
    folder: fetchFolderState.data,
  };
}

export function stringifyFolder({ title, parents }: FolderDTO) {
  return parents && parents?.length
    ? [...parents.map((p) => p.title), title].map(encodeTitle).join('/')
    : encodeTitle(title);
}

function encodeTitle(title: string): string {
  return title.replaceAll('/', '\\/');
}
