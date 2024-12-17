import { createSelector } from '@reduxjs/toolkit';

import { RootState } from 'app/store/configureStore';

import { parseListOptionsSelector } from '../../apiserver/client';
import { ListOptions } from '../../apiserver/types';
export * from './endpoints';

import { generatedAPI, RepositoryList } from './endpoints';

export const provisioningAPI = generatedAPI.enhanceEndpoints({
  endpoints: {
    listJob(endpoint) {
      endpoint.query = (queryArg) => ({
        url: `/jobs`,
        params: getListParams(queryArg),
      });
    },
    listRepository(endpoint) {
      endpoint.query = (queryArg) => ({
        url: `/repositories`,
        params: getListParams(queryArg),
      });
    },
  },
});

function getListParams<T extends ListOptions>(queryArg: T | void) {
  if (!queryArg) {
    return undefined;
  }
  const { fieldSelector, labelSelector, ...params } = queryArg;
  return {
    fieldSelector: fieldSelector ? parseListOptionsSelector(fieldSelector) : undefined,
    labelSelector: labelSelector ? parseListOptionsSelector(labelSelector) : undefined,
    ...params,
  };
}

const emptyRepos: RepositoryList['items'] = [];

const repositoriesResult = generatedAPI.endpoints.listRepository.select();
export const selectAllRepos = createSelector(repositoriesResult, (repos) => repos.data?.items || emptyRepos);
export const selectFolderRepository = createSelector(
  selectAllRepos,
  (state: RootState, folderUid?: string) => folderUid,
  (repositories, folderUid) => {
    if (!folderUid) {
      return undefined;
    }
    return repositories.find((repo) => repo.spec?.folder === folderUid);
  }
);

export const selectRepoByName = createSelector(
  selectAllRepos,
  (state: RootState, id: string) => id,
  (repositories, name) => repositories.find((repo) => repo.metadata?.name === name)
);
