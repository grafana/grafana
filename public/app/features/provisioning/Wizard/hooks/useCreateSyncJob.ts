import { t } from '@grafana/i18n';
import { useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';

import { StepStatusInfo } from '../types';

export interface UseCreateSyncJobParams {
  repoName: string;
  requiresMigration: boolean;
  migrateExistingResources?: boolean;
  setStepStatusInfo?: (info: StepStatusInfo) => void;
}

export function useCreateSyncJob({
  repoName,
  requiresMigration,
  migrateExistingResources,
  setStepStatusInfo,
}: UseCreateSyncJobParams) {
  const [createJob, { isLoading }] = useCreateRepositoryJobsMutation();

  const createSyncJob = async () => {
    if (!repoName) {
      setStepStatusInfo?.({
        status: 'error',
        error: t('provisioning.sync-job.error-no-repository-name', 'No repository name provided'),
      });
      return null;
    }

    try {
      setStepStatusInfo?.({ status: 'running' });

      const shouldMigrate = requiresMigration || migrateExistingResources === true;
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
