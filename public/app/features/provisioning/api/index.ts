import { createSelector } from '@reduxjs/toolkit';
import { Subscription } from 'rxjs';

import { RootState } from 'app/store/configureStore';

import { parseListOptionsSelector, ScopedResourceClient } from '../../apiserver/client';
import { ListOptions } from '../../apiserver/types';
export * from './endpoints';

import { generatedAPI, RepositoryList, RepositorySpec, RepositoryStatus } from './endpoints';

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
      endpoint.onCacheEntryAdded = async function (
        arg: ListOptions,
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved }
      ) {
        if (!arg?.watch) {
          return;
        }
        const client = new ScopedResourceClient<RepositorySpec, RepositoryStatus>({
          group: 'provisioning.grafana.app',
          version: 'v0alpha1',
          resource: 'repositories',
        });
        let subscription: Subscription | null = null;
        try {
          // wait for the initial query to resolve before proceeding
          const response = await cacheDataLoaded;
          const resourceVersion = response.data.metadata?.resourceVersion;

          subscription = client.watch({ resourceVersion: resourceVersion }).subscribe((event) => {
            updateCachedData((draft: RepositoryList) => {
              if (!draft.items) {
                draft.items = [];
              }

              const existingIndex = draft.items.findIndex((item) => item.metadata?.name === event.object.metadata.name);

              if (event.type === 'ADDED') {
                // Add the new item
                //@ts-expect-error TODO Fix types
                draft.items.push(event.object);
              } else if (event.type === 'MODIFIED') {
                // Update the existing item if it exists
                if (existingIndex !== -1) {
                  //@ts-expect-error TODO Fix types
                  draft.items[existingIndex] = event.object;
                }
              } else if (event.type === 'DELETED') {
                // Remove the item if it exists
                if (existingIndex !== -1) {
                  draft.items.splice(existingIndex, 1);
                }
              }
            });
          });
        } catch (error) {
          // no-op in case `cacheEntryRemoved` resolves before `cacheDataLoaded`,
          // in which case `cacheDataLoaded` will throw
          console.error('Error in onCacheEntryAdded:', error);
        }
        // cacheEntryRemoved will resolve when the cache subscription is no longer active
        await cacheEntryRemoved;
        // perform cleanup steps once the `cacheEntryRemoved` promise resolves

        subscription?.unsubscribe();
      };
    },
  },
});

function getListParams<T extends ListOptions>(queryArg: T | void) {
  if (!queryArg) {
    return undefined;
  }
  const { fieldSelector, labelSelector, watch, ...params } = queryArg;
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
