import { skipToken } from '@reduxjs/toolkit/query/react';

import { RepositoryView, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning';

import { Folder, useGetFolderQuery } from '../../../api/clients/folder';
import { AnnoKeyManagerIdentity } from '../../apiserver/types';

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
  const settings = useGetFrontendSettingsQuery();
  const folderQuery = useGetFolderQuery(name || !folderName ? skipToken : { name: folderName });
  const folder = folderQuery.data;

  if (settings.isLoading || folderQuery.isLoading) {
    return { isLoading: true, isInstanceManaged: false };
  }

  if (!settings.data?.items) {
    return { folder, isInstanceManaged: false }; // not found
  }

  const instanceRepo = settings.data.items.find((repo) => repo.target === 'instance');
  if (name) {
    const repository = settings.data.items.find((repo) => repo.name === name);
    if (repository) {
      return { repository, folder, isInstanceManaged: Boolean(instanceRepo) };
    }
  }

  // Find the matching folder repository
  if (folderName) {
    // For root values it will be the same
    let repository = settings.data.items.find((repo) => repo.name === folderName);
    if (repository) {
      return { repository, folder, isInstanceManaged: Boolean(instanceRepo) };
    }

    // For nested folders we need to see what the folder thinks
    folderName = folderQuery.data?.metadata?.annotations?.[AnnoKeyManagerIdentity];
    if (name) {
      repository = settings.data.items.find((repo) => repo.name === folderName);
      if (repository) {
        return { repository, folder, isInstanceManaged: Boolean(instanceRepo) };
      }
    }
  }

  return {
    repository: instanceRepo,
    folder,
    isInstanceManaged: Boolean(instanceRepo),
  };
};
