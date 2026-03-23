import { useCallback, useState } from 'react';

import { Job, useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';

import { OrphanedResourceAction } from '../components/Shared/OrphanedResourceActionConfirmModal';

export interface UseOrphanedResourceActionsOptions {
  repositoryName: string;
}

export interface UseOrphanedResourceActionsResult {
  submit: (action: OrphanedResourceAction) => Promise<Job>;
  submitRelease: () => Promise<Job>;
  submitDelete: () => Promise<Job>;
  isSubmitting: boolean;
  error: unknown;
  clearError: () => void;
}

export function useOrphanedResourceActions({
  repositoryName,
}: UseOrphanedResourceActionsOptions): UseOrphanedResourceActionsResult {
  const [createJob, { isLoading }] = useCreateRepositoryJobsMutation();
  const [error, setError] = useState<unknown>(null);

  const submit = useCallback(
    async (action: OrphanedResourceAction): Promise<Job> => {
      setError(null);
      try {
        return await createJob({
          name: repositoryName,
          jobSpec: { action, repository: repositoryName },
        }).unwrap();
      } catch (err) {
        setError(err);
        throw err;
      }
    },
    [repositoryName, createJob]
  );

  const submitRelease = useCallback(() => submit('releaseResources'), [submit]);
  const submitDelete = useCallback(() => submit('deleteResources'), [submit]);
  const clearError = useCallback(() => setError(null), []);

  return { submit, submitRelease, submitDelete, isSubmitting: isLoading, error, clearError };
}
