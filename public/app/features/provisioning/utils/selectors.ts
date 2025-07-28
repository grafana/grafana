import { createSelector } from '@reduxjs/toolkit';

import { Repository, provisioningAPIv0alpha1 as provisioningAPI } from '../../../api/clients/provisioning/v0alpha1';

const emptyRepos: Repository[] = [];

const getBaseSelector = () => provisioningAPI.endpoints.listRepository.select({});

export const selectAllRepos = () => createSelector(getBaseSelector(), (result) => result.data?.items || emptyRepos);

export const selectFolderRepository = () =>
  createSelector(
    selectAllRepos(),
    (_, folderUid?: string) => folderUid,
    (repositories: Repository[], folderUid) => {
      if (!folderUid) {
        return undefined;
      }
      return repositories.find((repo: Repository) => repo.metadata?.name === folderUid);
    }
  );
