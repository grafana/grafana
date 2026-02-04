import { t } from '@grafana/i18n';
import { useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';

import { StepStatusInfo } from '../types';

export interface UseCreateSyncJobParams {
  repoName: string;
  setStepStatusInfo?: (info: StepStatusInfo) => void;
}

export function useCreateSyncJob({ repoName, setStepStatusInfo }: UseCreateSyncJobParams) {
  const [createJob, { isLoading }] = useCreateRepositoryJobsMutation();

  const createSyncJob = async (requiresMigration: boolean) => {
    if (!repoName) {
      setStepStatusInfo?.({
        status: 'error',
        error: t('provisioning.sync-job.error-no-repository-name', 'No repository name provided'),
      });
      return null;
    }

    try {
      setStepStatusInfo?.({ status: 'running' });

      const jobSpec = requiresMigration
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
      const errorMessage = extractErrorMessage(error);
      setStepStatusInfo?.({
        status: 'error',
        error: {
          title: t('provisioning.sync-job.error-starting-job', 'Error starting job'),
          message: errorMessage,
        },
      });
      return null;
    }
  };

  return {
    createSyncJob,
    isLoading,
  };
}
