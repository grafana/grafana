import { useCallback } from 'react';

import { useCreateRepositoryMutation, useUpdateRepositoryMutation } from './api';
import { RepositorySpec } from './api/types';

export function useCreateOrUpdateRepository(name?: string) {
  const [create, createRequest] = useCreateRepositoryMutation();
  const [update, updateRequest] = useUpdateRepositoryMutation();

  const updateOrCreate = useCallback(
    (data: RepositorySpec) => {
      if (name) {
        return update({ name, body: { metadata: { name }, spec: data } });
      }
      return create({ metadata: { generateName: 'repository' }, spec: { ...data, title: 'test' } });
    },
    [create, name, update]
  );

  return [updateOrCreate, name ? updateRequest : createRequest] as const;
}
