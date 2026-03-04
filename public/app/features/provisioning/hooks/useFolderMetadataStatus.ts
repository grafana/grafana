import { skipToken } from '@reduxjs/toolkit/query/react';

import { isFetchError } from '@grafana/runtime';
import { useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';

import { getFolderMetadataPath } from '../utils/folderMetadata';

import { useGetResourceRepositoryView } from './useGetResourceRepositoryView';

export type FolderMetadataStatus = 'loading' | 'missing' | 'error' | 'ok';

export interface FolderMetadataResult {
  status: FolderMetadataStatus;
  repositoryName: string;
}

/**
 * Checks whether a single provisioned folder has a `_folder.json` metadata file.
 * Only call this for folders already known to be provisioned.
 */
export function useFolderMetadataStatus(folderUID: string): FolderMetadataResult {
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

  const { error, isLoading: isFileLoading } = useGetRepositoryFilesWithPathQuery(
    repoName ? { name: repoName, path: folderJsonPath } : skipToken
  );

  if (isRepoViewLoading || isFileLoading) {
    return { status: 'loading', repositoryName: repoName };
  }

  if (isFetchError(error) && error.status === 404) {
    return { status: 'missing', repositoryName: repoName };
  }

  if (error) {
    return { status: 'error', repositoryName: repoName };
  }

  return { status: 'ok', repositoryName: repoName };
}
