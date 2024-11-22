import { useCallback } from 'react';

import { useCreateRepositoryMutation, useListRepositoryQuery, useUpdateRepositoryMutation } from './api';
import { RepositoryResource, RepositorySpec } from './api/types';

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
