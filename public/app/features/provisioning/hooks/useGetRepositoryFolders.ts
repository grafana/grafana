/**
 * A hook to fetch folder paths from a repository's file listing.
 * Used to populate the path dropdown in the onboarding wizard.
 */
import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { getErrorMessage } from 'app/api/clients/provisioning/utils/httpUtils';
import { useGetRepositoryFilesQuery } from 'app/api/clients/provisioning/v0alpha1';

import { useRepositoryStatus } from '../Wizard/hooks/useRepositoryStatus';

export interface UseGetRepositoryFoldersProps {
  repositoryName?: string;
  ref?: string;
}

function isFileItem(obj: unknown): obj is { path: string } {
  if (typeof obj !== 'object' || obj === null || !('path' in obj)) {
    return false;
  }
  const candidate: { path: unknown } = obj;
  return typeof candidate.path === 'string';
}

export function useGetRepositoryFolders({ repositoryName, ref }: UseGetRepositoryFoldersProps) {
  const { isReconciled, isLoading: isRepoLoading, healthStatusNotReady } = useRepositoryStatus(repositoryName);

  const shouldSkipQuery = !repositoryName || !isReconciled;
  const {
    data: filesData,
    isLoading: isFilesLoading,
    error: filesError,
  } = useGetRepositoryFilesQuery(shouldSkipQuery ? skipToken : { name: repositoryName, ref });

  const options = useMemo(() => {
    const folders = new Set<string>();

    for (const file of filesData?.items ?? []) {
      if (!isFileItem(file)) {
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
    error: filesError
      ? getErrorMessage(filesError)
      : repositoryName
        ? null
        : t(
            'provisioning.connect-step.text-folders-not-available',
            'Folder suggestions will be available after the repository is connected.'
          ),
  };
}
