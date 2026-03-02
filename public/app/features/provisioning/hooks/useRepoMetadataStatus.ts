import { skipToken } from '@reduxjs/toolkit/query/react';
import { useMemo } from 'react';

import { useGetRepositoryFilesQuery, useGetRepositoryResourcesQuery } from 'app/api/clients/provisioning/v0alpha1';

import { checkFilesForMissingMetadata } from '../utils/folderMetadata';

import { type FolderMetadataResult } from './useFolderMetadataStatus';

/**
 * Checks whether any provisioned folder in a repository is missing its `_folder.json` metadata file.
 */
export function useRepoMetadataStatus(repositoryName: string): FolderMetadataResult {
  const filesQuery = useGetRepositoryFilesQuery(repositoryName ? { name: repositoryName } : skipToken);
  const resourcesQuery = useGetRepositoryResourcesQuery(repositoryName ? { name: repositoryName } : skipToken);

  const isLoading = filesQuery.isLoading || resourcesQuery.isLoading;
  const error = filesQuery.error || resourcesQuery.error;

  const hasMissing = useMemo(() => {
    if (isLoading || !filesQuery.data?.items || !resourcesQuery.data?.items) {
      return false;
    }
    return checkFilesForMissingMetadata(filesQuery.data.items, resourcesQuery.data.items);
  }, [filesQuery.data?.items, resourcesQuery.data?.items, isLoading]);

  if (isLoading) {
    return { status: 'loading', repositoryName };
  }

  if (error) {
    return { status: 'error', repositoryName };
  }

  return { status: hasMissing ? 'missing' : 'ok', repositoryName };
}
