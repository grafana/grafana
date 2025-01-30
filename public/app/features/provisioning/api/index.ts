import { createSelector } from '@reduxjs/toolkit';
import { Subscription } from 'rxjs';

import { RootState } from 'app/store/configureStore';

import { parseListOptionsSelector, ScopedResourceClient } from '../../apiserver/client';
import { ListOptions } from '../../apiserver/types';

import {
  generatedAPI,
  JobSpec,
  JobStatus,
  ListRepositoryArg,
  RepositoryList,
  RepositorySpec,
  RepositoryStatus,
} from './endpoints.gen';

export const provisioningAPI = generatedAPI.enhanceEndpoints({
  endpoints: {
    listJob(endpoint) {
      // Do not include 'watch' in the first query, so we can get the initial list of jobs
      // and then start watching for changes
      endpoint.query = ({ watch, ...queryArg }) => ({
        url: `/jobs`,
        params: queryArg,
      });
      endpoint.onCacheEntryAdded = createOnCacheEntryAdded<JobSpec, JobStatus>('jobs');
    },
    listRepository(endpoint) {
      endpoint.query = ({ watch, ...queryArg }) => ({
        url: `/repositories`,
        params: queryArg,
      });
      endpoint.onCacheEntryAdded = createOnCacheEntryAdded<RepositorySpec, RepositoryStatus>('repositories');
    },
  },
});

type ListParams = Omit<ListRepositoryArg, 'fieldSelector' | 'labelSelector'> &
  Pick<ListOptions, 'labelSelector' | 'fieldSelector'>;

/**
 * A helper function to remove the watch argument from the queryArg and convert field- and labelSelectors to strings
 */
export function getListParams(queryArg: ListParams) {
  if (!queryArg) {
    return {};
  }
  const { fieldSelector, labelSelector, watch, ...params } = queryArg;
  return {
    fieldSelector: fieldSelector ? parseListOptionsSelector(fieldSelector) : undefined,
    labelSelector: labelSelector ? parseListOptionsSelector(labelSelector) : undefined,
    ...params,
  };
}

const emptyRepos: RepositoryList['items'] = [];

const repositoriesResult = provisioningAPI.endpoints.listRepository.select({});
export const selectAllRepos = createSelector(repositoriesResult, (repos) => repos.data?.items || emptyRepos);
export const selectFolderRepository = createSelector(
  selectAllRepos,
  (state: RootState, folderUid?: string) => folderUid,
  (repositories, folderUid) => {
    if (!folderUid) {
      return undefined;
    }
    return repositories.find((repo) => repo.metadata?.name === folderUid);
  }
);

export const selectRepoByName = createSelector(
  selectAllRepos,
  (state: RootState, id: string) => id,
  (repositories, name) => repositories.find((repo) => repo.metadata?.name === name)
);

function createOnCacheEntryAdded<Spec, Status>(resourceName: string) {
  return async function onCacheEntryAdded(
    arg: ListOptions | undefined,
    {
      updateCachedData,
      cacheDataLoaded,
      cacheEntryRemoved,
    }: {
      updateCachedData: (fn: (draft: any) => void) => void;
      cacheDataLoaded: Promise<{ data: any }>;
      cacheEntryRemoved: Promise<void>;
    }
  ) {
    if (!arg?.watch) {
      return;
    }

    const client = new ScopedResourceClient<Spec, Status>({
      group: 'provisioning.grafana.app',
      version: 'v0alpha1',
      resource: resourceName,
    });

    let subscription: Subscription | null = null;
    try {
      // Wait for the initial query to resolve before proceeding
      const response = await cacheDataLoaded;
      const resourceVersion = response.data.metadata?.resourceVersion;
      subscription = client.watch({ resourceVersion }).subscribe((event) => {
        updateCachedData((draft) => {
          if (!draft.items) {
            draft.items = [];
          }
          const existingIndex = draft.items.findIndex(
            (item: any) => item.metadata?.name === event.object.metadata.name
          );

          if (event.type === 'ADDED') {
            // Add the new item
            draft.items.push(event.object);
          } else if (event.type === 'MODIFIED' && existingIndex !== -1) {
            // Update the existing item if it exists
            draft.items[existingIndex] = event.object;
          } else if (event.type === 'DELETED' && existingIndex !== -1) {
            // Remove the item if it exists
            draft.items.splice(existingIndex, 1);
          }
        });
      });
    } catch (error) {
      console.error('Error in onCacheEntryAdded:', error);
    }

    await cacheEntryRemoved;
    subscription?.unsubscribe();
  };
}
export * from './endpoints.gen';
