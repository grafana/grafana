import { skipToken } from '@reduxjs/toolkit/query/react';

import { isFetchError } from '@grafana/runtime';
import { useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';

import { getFolderMetadataPath } from '../utils/folderMetadata';

import { useGetResourceRepositoryView } from './useGetResourceRepositoryView';

export type FolderMetadataStatus = 'loading' | 'missing' | 'error' | 'ok';

/**
 * Checks whether a provisioned folder has a `_folder.json` metadata file.
 * Only call this for folders already known to be provisioned — the caller
 * (FolderPermissions) gates on `isProvisionedFolder` before rendering the
 * component that uses this hook.
 */
export function useFolderMetadataStatus(folderUID: string): FolderMetadataStatus {
  const {
    repository,
    folder,
    isLoading: isRepoViewLoading,
  } = useGetResourceRepositoryView({
    folderName: folderUID,
  });

  const sourcePath = folder?.metadata?.annotations?.[AnnoKeySourcePath]?.replace(/\/+$/, '');
  const repoName = repository?.name ?? '';
  const folderJsonPath = getFolderMetadataPath(sourcePath);

  const { error, isFetching: isFileLoading } = useGetRepositoryFilesWithPathQuery(
    repoName ? { name: repoName, path: folderJsonPath } : skipToken
  );

  if (isRepoViewLoading || isFileLoading) {
    return 'loading';
  }

  if (isFetchError(error) && error.status === 404) {
    return 'missing';
  }

  if (error) {
    return 'error';
  }

  return 'ok';
}
