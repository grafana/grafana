import { skipToken } from '@reduxjs/toolkit/query/react';

import { config, isFetchError } from '@grafana/runtime';
import { type Folder } from 'app/api/clients/folder/v1beta1';
import { type RepositoryView, useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';

import { useGetResourceRepositoryView } from './useGetResourceRepositoryView';

export type FolderReadmeStatus = 'loading' | 'missing' | 'error' | 'ok';

export interface UseFolderReadmeResult {
  repository?: RepositoryView;
  folder?: Folder;
  /** Path of the README relative to the repository's configured root. */
  readmePath: string;
  status: FolderReadmeStatus;
  fileData: ReturnType<typeof useGetRepositoryFilesWithPathQuery>['data'];
  refetch: () => void;
}

/**
 * Resolves a folder's README.md path (using the source-path annotation when
 * present) and fetches it through the provisioning files API. Skips the fetch
 * when the `provisioningReadmes` toggle is off.
 *
 * Returns a tagged `status` instead of raw boolean flags so callers can
 * exhaustively switch on the four states without reconstructing the machine.
 */
export function useFolderReadme(folderUID: string): UseFolderReadmeResult {
  const { repository, folder, isLoading: isRepoLoading } = useGetResourceRepositoryView({ folderName: folderUID });

  const sourcePath = folder?.metadata?.annotations?.[AnnoKeySourcePath] || '';
  const readmePath = sourcePath ? `${sourcePath.replace(/\/+$/, '')}/README.md` : 'README.md';

  const shouldFetch = !!config.featureToggles.provisioningReadmes && !!repository && !!folderUID && !isRepoLoading;

  const {
    data: fileData,
    isLoading: isFileLoading,
    error,
    refetch,
  } = useGetRepositoryFilesWithPathQuery(
    shouldFetch
      ? {
          name: repository.name,
          path: readmePath,
        }
      : skipToken
  );

  let status: FolderReadmeStatus;
  if (isRepoLoading || isFileLoading) {
    status = 'loading';
  } else if (error && isFetchError(error) && error.status === 404) {
    status = 'missing';
  } else if (error) {
    status = 'error';
  } else if (fileData) {
    status = 'ok';
  } else {
    // No error, no data, not loading — shouldn't happen in practice but
    // treat as loading (the query hasn't started, e.g. skipToken is active).
    status = 'loading';
  }

  return {
    repository,
    folder,
    readmePath,
    status,
    fileData,
    refetch,
  };
}
