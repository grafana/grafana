import { skipToken } from '@reduxjs/toolkit/query/react';

import { config } from '@grafana/runtime';
import { type Folder, useGetFolderQuery } from 'app/api/clients/folder/v1beta1';
import { type RepositoryView, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';

import { type RepoType } from '../Wizard/types';
import { getIsReadOnlyRepo } from '../utils/repository';

interface GetResourceRepositoryArgs {
  name?: string; // the repository name
  folderName?: string; // folder we are targeting
  skipQuery?: boolean;
}

export enum RepoViewStatus {
  Disabled = 'disabled',
  Loading = 'loading',
  Ready = 'ready',
  Error = 'error',
  Orphaned = 'orphaned',
}

interface RepositoryViewData {
  repository?: RepositoryView;
  repoType?: RepoType;
  folder?: Folder;
  status: RepoViewStatus;
  error?: unknown;
  orphanedRepoName?: string; // Only present when status is RepoViewStatus.Orphaned
  isLoading?: boolean; // TODO: status now contains loading state, this can be removed
  isInstanceManaged: boolean;
  isReadOnlyRepo: boolean;
}

// This is safe to call as a viewer (you do not need full access to the Repository configs)
export const useGetResourceRepositoryView = ({
  name,
  folderName,
  skipQuery,
}: GetResourceRepositoryArgs): RepositoryViewData => {
  const provisioningEnabled = config.featureToggles.provisioning;
  const shouldSkipSettings = !provisioningEnabled || skipQuery || (!name && !folderName);
  const settingsQueryArg = shouldSkipSettings ? skipToken : undefined;

  const {
    data: settingsData,
    isLoading: isSettingsLoading,
    error: settingsError,
  } = useGetFrontendSettingsQuery(settingsQueryArg);

  const skipFolderQuery = !folderName || !provisioningEnabled || skipQuery;
  const {
    data: folder,
    isLoading: isFolderLoading,
    error: folderError,
  } = useGetFolderQuery(skipFolderQuery ? skipToken : { name: folderName });

  if (!provisioningEnabled) {
    return {
      isLoading: false,
      isInstanceManaged: false,
      isReadOnlyRepo: false,
      status: RepoViewStatus.Disabled,
    };
  }

  if (isSettingsLoading || isFolderLoading) {
    return {
      isLoading: true,
      isInstanceManaged: false,
      isReadOnlyRepo: false,
      status: RepoViewStatus.Loading,
    };
  }

  if (settingsError || folderError) {
    return {
      isLoading: false,
      isInstanceManaged: false,
      isReadOnlyRepo: false,
      status: RepoViewStatus.Error,
      error: settingsError || folderError,
    };
  }

  const items = settingsData?.items ?? [];

  // Check for orphaned resource first: name specified but no matching repo
  if (name) {
    const repository = items.find((repo) => repo.name === name);
    const instanceRepo = items.find((repo) => repo.target === 'instance');
    if (repository) {
      return {
        repository,
        folder,
        isInstanceManaged: Boolean(instanceRepo),
        isReadOnlyRepo: getIsReadOnlyRepo(repository),
        status: RepoViewStatus.Ready,
      };
    }

    // When name specified but no matching repository found = orphaned resource
    return {
      folder,
      isInstanceManaged: Boolean(instanceRepo),
      isReadOnlyRepo: false,
      status: RepoViewStatus.Orphaned,
      orphanedRepoName: name,
    };
  }

  if (!items.length) {
    return { folder, isInstanceManaged: false, isReadOnlyRepo: false, status: RepoViewStatus.Ready };
  }

  const instanceRepo = items.find((repo) => repo.target === 'instance');
  const isInstanceManaged = Boolean(instanceRepo);

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
        status: RepoViewStatus.Ready,
      };
    }

    // For nested folders we need to see what the folder thinks.
    // Only treat as repo-managed if the manager kind is explicitly 'repo' —
    // folders managed by plugins, terraform, kubectl, etc. should not be matched against provisioning repos.
    const annotatedManagerKind = folder?.metadata?.annotations?.[AnnoKeyManagerKind];
    const annotatedFolderName = folder?.metadata?.annotations?.[AnnoKeyManagerIdentity];
    if (annotatedFolderName && annotatedManagerKind === ManagerKind.Repo) {
      repository = items.find((repo) => repo.name === annotatedFolderName);
      if (repository) {
        return {
          repository,
          folder,
          isInstanceManaged,
          isReadOnlyRepo: getIsReadOnlyRepo(repository),
          status: RepoViewStatus.Ready,
        };
      }

      // Folder has a manager identity annotation but the repo no longer exists = orphaned
      return {
        folder,
        isInstanceManaged,
        isReadOnlyRepo: false,
        status: RepoViewStatus.Orphaned,
        orphanedRepoName: annotatedFolderName,
      };
    }
  }

  return {
    repository: instanceRepo,
    folder,
    isInstanceManaged,
    isReadOnlyRepo: getIsReadOnlyRepo(instanceRepo),
    repoType: instanceRepo?.type,
    status: RepoViewStatus.Ready,
  };
};
