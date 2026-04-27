/**
 * A hook to fetch folder paths from a repository's file listing.
 * Used to populate the path dropdown in the onboarding wizard.
 */
import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { isObject } from '@grafana/data/types';
import { t } from '@grafana/i18n';
import { getErrorMessage } from 'app/api/clients/provisioning/utils/httpUtils';
import { useGetRepositoryFilesQuery } from 'app/api/clients/provisioning/v0alpha1';

import { useRepositoryStatus } from '../Wizard/hooks/useRepositoryStatus';

export interface UseGetRepositoryFoldersProps {
  repositoryName?: string;
  ref?: string;
}

// The generated API client types `items` loosely (path is optional/unknown),
// so a runtime guard is needed to safely access `file.path`.
function isFileItem(obj: unknown): obj is { path: string } {
  return isObject(obj) && 'path' in obj && typeof obj.path === 'string';
}

export function useGetRepositoryFolders({ repositoryName, ref }: UseGetRepositoryFoldersProps) {
  const {
    isReconciled,
    isLoading: isRepoLoading,
    hasError: isRepoError,
    healthStatusNotReady,
  } = useRepositoryStatus(repositoryName);

  const shouldSkipQuery = !repositoryName || !isReconciled;
  const {
    data: filesData,
    isLoading: isFilesLoading,
    error: filesError,
  } = useGetRepositoryFilesQuery(shouldSkipQuery ? skipToken : { name: repositoryName, ref });

  const options = useMemo(() => {
    const folders = new Set<string>();

    for (const file of filesData?.items ?? []) {
      if (!isFileItem(file) || file.path.startsWith('.')) {
        continue;
      }

      const parts = file.path.split('/');
      for (let i = 1; i < parts.length; i++) {
        const folderPath = parts.slice(0, i).join('/');
        folders.add(folderPath);
      }
    }

    return Array.from(folders)
      .sort()
      .map((path) => ({ label: path, value: path }));
  }, [filesData]);

  return {
    options,
    loading: isFilesLoading || isRepoLoading || healthStatusNotReady,
    error: isRepoError
      ? t(
          'provisioning.connect-step.text-repository-folders-not-ready',
          'There was an issue connecting to the repository. You can still manually enter the folder path.'
        )
      : filesError
        ? getErrorMessage(filesError)
        : null,
    hint: repositoryName
      ? null
      : t(
          'provisioning.connect-step.text-folders-not-available',
          'Folder suggestions will be available after the repository is connected.'
        ),
  };
}
