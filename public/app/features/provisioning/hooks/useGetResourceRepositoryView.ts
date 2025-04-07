import { skipToken } from '@reduxjs/toolkit/query/react';

import { Folder, useGetFolderQuery } from 'app/api/clients/folder';
import { RepositoryView, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning';
import { AnnoKeyManagerIdentity } from 'app/features/apiserver/types';

interface GetResourceRepositoryArgs {
  name?: string; // the repository name
  folderName?: string; // folder we are targeting
}

interface RepositoryViewData {
  repository?: RepositoryView;
  folder?: Folder;
  isLoading?: boolean;
  isInstanceManaged: boolean;
}

// This is safe to call as a viewer (you do not need full access to the Repository configs)
export const useGetResourceRepositoryView = ({ name, folderName }: GetResourceRepositoryArgs): RepositoryViewData => {
  const { data: settingsData, isLoading: isSettingsLoading } = useGetFrontendSettingsQuery();
  const skipFolderQuery = name || !folderName;
  const { data: folder, isLoading: isFolderLoading } = useGetFolderQuery(
    skipFolderQuery ? skipToken : { name: folderName }
  );

  if (isSettingsLoading || isFolderLoading) {
    return { isLoading: true, isInstanceManaged: false };
  }

  const items = settingsData?.items ?? [];

  if (!items.length) {
    return { folder, isInstanceManaged: false };
  }

  const instanceRepo = items.find((repo) => repo.target === 'instance');
  const isInstanceManaged = Boolean(instanceRepo);

  if (name) {
    const repository = items.find((repo) => repo.name === name);
    if (repository) {
      return {
        repository,
        folder,
        isInstanceManaged,
      };
    }
  }

  // Find the matching folder repository
  if (folderName) {
    // For root values it will be the same
    let repository = items.find((repo) => repo.name === folderName);
    if (repository) {
      return {
        repository,
        folder,
        isInstanceManaged,
      };
    }

    // For nested folders we need to see what the folder thinks
    const annotatedFolderName = folder?.metadata?.annotations?.[AnnoKeyManagerIdentity];
    if (annotatedFolderName) {
      repository = items.find((repo) => repo.name === annotatedFolderName);
      if (repository) {
        return {
          repository,
          folder,
          isInstanceManaged,
        };
      }
    }
  }

  return {
    repository: instanceRepo,
    folder,
    isInstanceManaged,
  };
};
