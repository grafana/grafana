import { skipToken } from '@reduxjs/toolkit/query/react';
import { useCallback } from 'react';

import { useUrlParams } from 'app/core/navigation/hooks';

import { useGetFolderQuery } from '../browse-dashboards/api/browseDashboardsAPI';

import {
  ListRepositoryArg,
  ReplaceRepositoryFilesWithPathArg,
  Repository,
  RepositorySpec,
  useCreateRepositoryFilesWithPathMutation,
  useCreateRepositoryMutation,
  useListRepositoryQuery,
  useReplaceRepositoryFilesWithPathMutation,
  useReplaceRepositoryMutation,
  useListJobQuery,
  Job,
} from './api';

export function useCreateOrUpdateRepository(name?: string) {
  const [create, createRequest] = useCreateRepositoryMutation();
  const [update, updateRequest] = useReplaceRepositoryMutation();

  const generateRepositoryMetadata = (data: RepositorySpec) => {
    // We don't know for sure that we can use a normalised name. If we can't, we'll ask the server to generate one for us.
    const normalisedName = data.title.toLowerCase().replaceAll(/[^a-z0-9\-_]+/g, '');

    if (
      crypto.randomUUID && // we might not be in a secure context
      normalisedName && // we need a non-empty string before we check the first character
      normalisedName.charAt(0) >= 'a' && // required to start with a letter to be a valid k8s name
      normalisedName.charAt(0) <= 'z' &&
      normalisedName.replaceAll(/[^a-z]/g, '').length >= 3 // must look sensible to a human
    ) {
      // We still want a suffix, to avoid name collisions.
      const randomBit = crypto.randomUUID().substring(0, 7);
      const shortenedName = normalisedName.substring(0, 63 - 1 - randomBit.length);
      return { name: `${shortenedName}-${randomBit}` };
    } else {
      return { generateName: 'r' };
    }
  };

  const updateOrCreate = useCallback(
    (data: RepositorySpec) => {
      if (name) {
        return update({ name, repository: { metadata: { name }, spec: data } });
      }
      return create({ repository: { metadata: generateRepositoryMetadata(data), spec: data } });
    },
    [create, name, update]
  );

  return [updateOrCreate, name ? updateRequest : createRequest] as const;
}

// Sort repositories alphabetically by title
export function useRepositoryList(options: ListRepositoryArg = {}): [Repository[] | undefined, boolean] {
  const query = useListRepositoryQuery(options);
  const collator = new Intl.Collator(undefined, { numeric: true });

  const sortedItems = query.data?.items?.slice().sort((a, b) => {
    const titleA = a.spec?.title ?? '';
    const titleB = b.spec?.title ?? '';
    return collator.compare(titleA, titleB);
  });

  return [sortedItems, query.isLoading];
}

export function useCreateOrUpdateRepositoryFile(name?: string) {
  const [create, createRequest] = useCreateRepositoryFilesWithPathMutation();
  const [update, updateRequest] = useReplaceRepositoryFilesWithPathMutation();

  const updateOrCreate = useCallback(
    (data: ReplaceRepositoryFilesWithPathArg) => {
      const actions = name ? update : create;
      return actions(data);
    },
    [create, name, update]
  );

  return [updateOrCreate, name ? updateRequest : createRequest] as const;
}

export const usePullRequestParam = () => {
  const [params] = useUrlParams();
  const prParam = params.get('pull_request_url');

  if (!prParam) {
    return undefined;
  }

  return decodeURIComponent(prParam);
};

interface GetResourceRepositoryArgs {
  name?: string;
  folderUid?: string;
}

export const useGetResourceRepository = ({ name, folderUid }: GetResourceRepositoryArgs) => {
  const [items, isLoading] = useRepositoryList();
  // Get the folder data from API to get repository data for nested folders
  const folderQuery = useGetFolderQuery(name || !folderUid ? skipToken : folderUid);

  const repoName = name || folderQuery.data?.repository?.name;

  if (!items?.length || isLoading || !repoName) {
    return undefined;
  }

  return items.find((repo) => repo.metadata?.name === repoName);
};

interface RepositoryJobsArgs {
  name?: string;
  watch?: boolean;
}

export function useRepositoryJobs({ name, watch = true }: RepositoryJobsArgs = {}): [
  Job[] | undefined,
  ReturnType<typeof useListJobQuery>,
] {
  const query = useListJobQuery(
    name
      ? {
          labelSelector: `repository=${name}`,
          watch,
        }
      : skipToken
  );

  const collator = new Intl.Collator(undefined, { numeric: true });

  const sortedItems = query.data?.items?.slice().sort((a, b) => {
    const aTime = a.metadata?.creationTimestamp ?? '';
    const bTime = b.metadata?.creationTimestamp ?? '';
    return collator.compare(bTime, aTime); // Reverse order for newest first
  });

  return [sortedItems, query];
}
