import { useCallback, useState } from 'react';

import { Job, useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';

export interface UseOrphanedResourceActionsOptions {
  repositoryName: string;
}

export interface UseOrphanedResourceActionsResult {
  submit: (action: 'release' | 'delete') => Promise<Job>;
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
    async (action: 'release' | 'delete'): Promise<Job> => {
      setError(null);
      try {
        const jobAction = action === 'release' ? ('releaseResources' as const) : ('deleteResources' as const);
        return await createJob({
          name: repositoryName,
          jobSpec: { action: jobAction, repository: repositoryName },
        }).unwrap();
      } catch (err) {
        setError(err);
        throw err;
      }
    },
    [repositoryName, createJob]
  );

  const submitRelease = useCallback(() => submit('release'), [submit]);
  const submitDelete = useCallback(() => submit('delete'), [submit]);
  const clearError = useCallback(() => setError(null), []);

  return { submit, submitRelease, submitDelete, isSubmitting: isLoading, error, clearError };
}
