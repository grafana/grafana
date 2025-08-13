import { skipToken } from '@reduxjs/toolkit/query/react';

import { config } from '@grafana/runtime';
import { Folder, useGetFolderQuery } from 'app/api/clients/folder/v1beta1';
import { RepositoryView, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerIdentity } from 'app/features/apiserver/types';

import { RepoType } from '../Wizard/types';
import { getIsReadOnlyRepo } from '../utils/repository';

interface GetResourceRepositoryArgs {
  name?: string; // the repository name
  folderName?: string; // folder we are targeting
}

interface RepositoryViewData {
  repository?: RepositoryView;
  repoType?: RepoType;
  folder?: Folder;
  isLoading?: boolean;
  isInstanceManaged: boolean;
  isReadOnlyRepo: boolean;
}

// This is safe to call as a viewer (you do not need full access to the Repository configs)
export const useGetResourceRepositoryView = ({ name, folderName }: GetResourceRepositoryArgs): RepositoryViewData => {
  const provisioningEnabled = config.featureToggles.provisioning;
  const { data: settingsData, isLoading: isSettingsLoading } = useGetFrontendSettingsQuery(
    !provisioningEnabled ? skipToken : undefined
  );

  const skipFolderQuery = !folderName || !provisioningEnabled;
  const { data: folder, isLoading: isFolderLoading } = useGetFolderQuery(
    skipFolderQuery ? skipToken : { name: folderName }
  );

  if (!provisioningEnabled) {
    return { isLoading: false, isInstanceManaged: false, isReadOnlyRepo: false };
  }

  if (isSettingsLoading || isFolderLoading) {
    return { isLoading: true, isInstanceManaged: false, isReadOnlyRepo: false };
  }

  const items = settingsData?.items ?? [];

  if (!items.length) {
    return { folder, isInstanceManaged: false, isReadOnlyRepo: false };
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
        isReadOnlyRepo: getIsReadOnlyRepo(repository),
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
        isReadOnlyRepo: getIsReadOnlyRepo(repository),
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
          isReadOnlyRepo: getIsReadOnlyRepo(repository),
        };
      }
    }
  }

  return {
    repository: instanceRepo,
    folder,
    isInstanceManaged,
    isReadOnlyRepo: getIsReadOnlyRepo(instanceRepo),
    repoType: instanceRepo?.type,
  };
};
