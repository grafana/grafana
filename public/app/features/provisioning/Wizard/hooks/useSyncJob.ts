import { useCallback, useState } from 'react';

import { type Job } from 'app/api/clients/provisioning/v0alpha1';

import { type StepStatusInfo } from '../types';

import { useCreateSyncJob, type SyncJobOptions } from './useCreateSyncJob';

export interface UseSyncJobParams {
  repoName: string;
  setStepStatusInfo?: (info: StepStatusInfo) => void;
}

/**
 * Owns the lifecycle of a single sync/migrate job: creates it via useCreateSyncJob and
 * tracks the created Job so a JobStatus view can watch it. Callers compose their own retry
 * from startJob + setJob because retry presentation differs (the wizard clears the job to
 * return to its form; the migrate drawer keeps it to avoid flashing back to the setup form).
 */
export function useSyncJob({ repoName, setStepStatusInfo }: UseSyncJobParams) {
  const { createSyncJob, isLoading } = useCreateSyncJob({ repoName, setStepStatusInfo });
  const [job, setJob] = useState<Job>();

  const startJob = useCallback(
    async (requiresMigration: boolean, options?: SyncJobOptions) => {
      const response = await createSyncJob(requiresMigration, options);
      if (response) {
        setJob(response);
      }
    },
    [createSyncJob]
  );

  return { job, setJob, startJob, isLoading };
}
