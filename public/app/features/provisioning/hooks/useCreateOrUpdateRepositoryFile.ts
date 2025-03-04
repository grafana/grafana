import { useCallback } from 'react';

import {
  ReplaceRepositoryFilesWithPathArg,
  useCreateRepositoryFilesWithPathMutation,
  useReplaceRepositoryFilesWithPathMutation,
} from '../api';

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
