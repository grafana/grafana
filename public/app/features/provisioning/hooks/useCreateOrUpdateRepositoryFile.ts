import { useCallback } from 'react';

import {
  ReplaceRepositoryFilesWithPathApiArg,
  useCreateRepositoryFilesWithPathMutation,
  useReplaceRepositoryFilesWithPathMutation,
} from 'app/api/clients/provisioning/v0alpha1';

export function useCreateOrUpdateRepositoryFile(name?: string) {
  const [create, createRequest] = useCreateRepositoryFilesWithPathMutation();
  const [update, updateRequest] = useReplaceRepositoryFilesWithPathMutation();

  const updateOrCreate = useCallback(
    (data: ReplaceRepositoryFilesWithPathApiArg) => {
      const actions = name ? update : create;
      return actions(data);
    },
    [create, name, update]
  );

  return [updateOrCreate, name ? updateRequest : createRequest] as const;
}
