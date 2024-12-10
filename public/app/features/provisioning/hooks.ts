import { useCallback } from 'react';

import { useUrlParams } from 'app/core/navigation/hooks';

import {
  useCreateRepositoryFilesMutation,
  useCreateRepositoryMutation,
  useListRepositoryQuery,
  useUpdateRepositoryFilesMutation,
  useUpdateRepositoryMutation,
} from './api';
import { FileOperationArg, RepositoryResource, RepositorySpec } from './api/types';

export function useCreateOrUpdateRepository(name?: string) {
  const [create, createRequest] = useCreateRepositoryMutation();
  const [update, updateRequest] = useUpdateRepositoryMutation();

  const updateOrCreate = useCallback(
    (data: RepositorySpec) => {
      if (name) {
        return update({ name, body: { metadata: { name }, spec: data } });
      }
      return create({ metadata: { generateName: 'repository' }, spec: data });
    },
    [create, name, update]
  );

  return [updateOrCreate, name ? updateRequest : createRequest] as const;
}

// Sort repositories by resourceVersion to show the last modified
export function useRepositoryList(): [RepositoryResource[] | undefined, boolean] {
  const query = useListRepositoryQuery();

  const sortedItems = query.data?.items?.slice().sort((a, b) => {
    return Number(b.metadata.resourceVersion) - Number(a.metadata.resourceVersion);
  });

  return [sortedItems, query.isLoading];
}

export function useCreateOrUpdateRepositoryFile(name?: string) {
  const [create, createRequest] = useCreateRepositoryFilesMutation();
  const [update, updateRequest] = useUpdateRepositoryFilesMutation();

  const updateOrCreate = useCallback(
    (data: FileOperationArg) => {
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
