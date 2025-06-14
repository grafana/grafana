import { useCallback } from 'react';

import {
  DeleteRepositoryFilesWithPathApiArg,
  useDeleteRepositoryFilesWithPathMutation,
} from 'app/api/clients/provisioning/v0alpha1';

export function useDeleteRepositoryFiles() {
  const [deleteFile, deleteRepoFileRequest] = useDeleteRepositoryFilesWithPathMutation();

  const deleteRepoFile = useCallback(
    (data: DeleteRepositoryFilesWithPathApiArg) => {
      return deleteFile(data);
    },
    [deleteFile]
  );

  return [deleteRepoFile, deleteRepoFileRequest] as const;
}
