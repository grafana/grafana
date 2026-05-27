import { useCallback, useState } from 'react';

import { type Job, useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';

import { type OrphanedResourceAction } from '../components/Shared/OrphanedResourceActionConfirmModal';

export interface UseOrphanedResourceActionsOptions {
  repositoryName: string;
}

export interface UseOrphanedResourceActionsResult {
  submit: (action: OrphanedResourceAction) => Promise<Job | undefined>;
  submitRelease: () => Promise<Job | undefined>;
  submitDelete: () => Promise<Job | undefined>;
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
    async (action: OrphanedResourceAction): Promise<Job | undefined> => {
      setError(null);
      try {
        return await createJob({
          name: repositoryName,
          jobSpec: { action, repository: repositoryName },
        }).unwrap();
      } catch (err) {
        // Error is stored in hook state (`error`) and surfaced by the caller via that field.
        // Returning undefined signals "no job created" so callers can skip job tracking.
        setError(err);
        return undefined;
      }
    },
    [repositoryName, createJob]
  );

  const submitRelease = useCallback(() => submit('releaseResources'), [submit]);
  const submitDelete = useCallback(() => submit('deleteResources'), [submit]);
  const clearError = useCallback(() => setError(null), []);

  return { submit, submitRelease, submitDelete, isSubmitting: isLoading, error, clearError };
}
