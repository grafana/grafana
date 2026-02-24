import { skipToken } from '@reduxjs/toolkit/query/react';

import { config, isFetchError } from '@grafana/runtime';
import { useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerKind, AnnoKeySourcePath, ManagerKind } from 'app/features/apiserver/types';

import { FOLDER_METADATA_FILE } from '../constants';

import { useGetResourceRepositoryView } from './useGetResourceRepositoryView';

export type FolderMetadataStatus = 'loading' | 'missing' | 'error' | 'ok';

export function useFolderMetadataStatus(folderUID?: string): FolderMetadataStatus {
  const shouldCheck = !!config.featureToggles.provisioningFolderMetadata && !!folderUID;

  const {
    repository,
    folder,
    isLoading: isRepoViewLoading,
  } = useGetResourceRepositoryView({
    folderName: folderUID,
    skipQuery: !shouldCheck,
  });

  const annotations = folder?.metadata?.annotations;
  const isProvisioned = annotations?.[AnnoKeyManagerKind] === ManagerKind.Repo;
  const sourcePath = annotations?.[AnnoKeySourcePath]?.replace(/\/+$/, '');
  const repoName = repository?.name ?? '';
  const folderJsonPath = sourcePath ? `${sourcePath}/${FOLDER_METADATA_FILE}` : FOLDER_METADATA_FILE;

  const shouldQueryFile = shouldCheck && isProvisioned && !!repoName;

  const { error, isLoading: isFileLoading } = useGetRepositoryFilesWithPathQuery(
    shouldQueryFile ? { name: repoName, path: folderJsonPath } : skipToken
  );

  // Feature flag off or no folder — no metadata check needed
  if (!shouldCheck) {
    return 'ok';
  }

  if (isRepoViewLoading) {
    return 'loading';
  }

  // Not provisioned or no repository — folder doesn't need metadata, show permissions normally
  if (!isProvisioned || !repository) {
    return 'ok';
  }

  if (isFileLoading) {
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
