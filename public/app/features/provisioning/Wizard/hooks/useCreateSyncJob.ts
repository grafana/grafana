import { t } from '@grafana/i18n';
import { useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';

import { StepStatusInfo, Target } from '../types';

export interface UseCreateSyncJobParams {
  repoName: string;
  requiresMigration: boolean;
  syncTarget?: Target;
  setStepStatusInfo?: (info: StepStatusInfo) => void;
}

export interface CreateSyncJobOptions {
  migrateResources?: boolean;
}

export function useCreateSyncJob({
  repoName,
  requiresMigration,
  syncTarget,
  setStepStatusInfo,
}: UseCreateSyncJobParams) {
  const [createJob, { isLoading }] = useCreateRepositoryJobsMutation();

  const createSyncJob = async (options?: CreateSyncJobOptions) => {
    if (!repoName) {
      setStepStatusInfo?.({
        status: 'error',
        error: t('provisioning.sync-job.error-no-repository-name', 'No repository name provided'),
      });
      return null;
    }

    try {
      setStepStatusInfo?.({ status: 'running' });

      // Determine if we should run a migration job:
      // - For instance sync: always migrate if there are resources
      // - For folder sync: migrate only if user explicitly opted in via checkbox
      const shouldMigrate =
        syncTarget === 'instance' ? requiresMigration : syncTarget === 'folder' && options?.migrateResources;

      const jobSpec = shouldMigrate
        ? {
            migrate: {},
          }
        : {
            pull: {
              incremental: false,
            },
          };

      const response = await createJob({
        name: repoName,
        jobSpec,
      }).unwrap();

      if (!response?.metadata?.name) {
        setStepStatusInfo?.({
          status: 'error',
          error: t('provisioning.sync-job.error-no-job-id', 'Failed to start job'),
        });
        return null;
      }

      // Job status will be tracked by JobStatus component, keep status as 'running'
      return response;
    } catch (error) {
      setStepStatusInfo?.({
        status: 'error',
        error: t('provisioning.sync-job.error-starting-job', 'Error starting job'),
      });
      return null;
    }
  };

  return {
    createSyncJob,
    isLoading,
  };
}
