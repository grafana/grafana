import { skipToken } from '@reduxjs/toolkit/query/react';

import { config } from '@grafana/runtime';
import { type Folder } from 'app/api/clients/folder/v1beta1';
import { type RepositoryView, useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';

import { useGetResourceRepositoryView } from './useGetResourceRepositoryView';

interface UseFolderReadmeResult {
  repository?: RepositoryView;
  folder?: Folder;
  /** Path of the README relative to the repository's configured root. */
  readmePath: string;
  isRepoLoading: boolean;
  isFileLoading: boolean;
  isError: boolean;
  fileData: ReturnType<typeof useGetRepositoryFilesWithPathQuery>['data'];
}

/**
 * Resolves a folder's README.md path (using the source-path annotation when
 * present) and fetches it through the provisioning files API. Skips the fetch
 * when the `provisioningReadmes` toggle is off.
 */
export function useFolderReadme(folderUID: string): UseFolderReadmeResult {
  const { repository, folder, isLoading: isRepoLoading } = useGetResourceRepositoryView({ folderName: folderUID });

  const sourcePath = folder?.metadata?.annotations?.[AnnoKeySourcePath] || '';
  const readmePath = sourcePath ? `${sourcePath.replace(/\/+$/, '')}/README.md` : 'README.md';

  const shouldFetch = !!config.featureToggles.provisioningReadmes && !!repository && !!folderUID && !isRepoLoading;

  const {
    data: fileData,
    isLoading: isFileLoading,
    isError,
  } = useGetRepositoryFilesWithPathQuery(
    shouldFetch
      ? {
          name: repository.name,
          path: readmePath,
        }
      : skipToken
  );

  return {
    repository,
    folder,
    readmePath,
    isRepoLoading: !!isRepoLoading,
    isFileLoading,
    isError,
    fileData,
  };
}
