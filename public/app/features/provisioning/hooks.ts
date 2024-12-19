import { useCallback } from 'react';

import { useUrlParams } from 'app/core/navigation/hooks';

import {
  Repository,
  useCreateRepositoryFilesWithPathMutation,
  useCreateRepositoryMutation,
  useListRepositoryQuery,
  usePutRepositoryFilesWithPathMutation,
  useUpdateRepositoryMutation,
  RepositorySpec,
  PutRepositoryFilesWithPathArg,
} from './api';

export function useCreateOrUpdateRepository(name?: string) {
  const [create, createRequest] = useCreateRepositoryMutation();
  const [update, updateRequest] = useUpdateRepositoryMutation();

  const updateOrCreate = useCallback(
    (data: RepositorySpec) => {
      if (name) {
        return update({ name, body: { metadata: { name }, spec: data } });
      }
      return create({ body: { metadata: { generateName: 'r' }, spec: data } });
    },
    [create, name, update]
  );

  return [updateOrCreate, name ? updateRequest : createRequest] as const;
}

// Sort repositories by resourceVersion to show the last modified
export function useRepositoryList(): [Repository[] | undefined, boolean] {
  const query = useListRepositoryQuery();

  const sortedItems = query.data?.items?.slice().sort((a, b) => {
    return Number(b.metadata?.resourceVersion) - Number(a.metadata?.resourceVersion);
  });

  return [sortedItems, query.isLoading];
}

export function useCreateOrUpdateRepositoryFile(name?: string) {
  const [create, createRequest] = useCreateRepositoryFilesWithPathMutation();
  const [update, updateRequest] = usePutRepositoryFilesWithPathMutation();

  const updateOrCreate = useCallback(
    (data: PutRepositoryFilesWithPathArg) => {
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

export const useFolderRepository = (folderUid?: string) => {
  const [items, isLoading] = useRepositoryList();

  if (!folderUid) {
    return undefined;
  }

  if (!items?.length || isLoading || !folderUid) {
    return undefined;
  }

  return items.find((repo) => repo.spec?.folder === folderUid);
};
