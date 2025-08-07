import { t } from '@grafana/i18n';
import { useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';

import { isGitProvider } from '../../utils/repositoryTypes';
import { RepoType, StepStatusInfo } from '../types';

export interface UseCreateSyncJobParams {
  repoName: string;
  requiresMigration: boolean;
  repoType: RepoType;
  isLegacyStorage?: boolean;
  setStepStatusInfo?: (info: StepStatusInfo) => void;
}

export function useCreateSyncJob({
  repoName,
  requiresMigration,
  repoType,
  isLegacyStorage,
  setStepStatusInfo,
}: UseCreateSyncJobParams) {
  const [createJob, { isLoading }] = useCreateRepositoryJobsMutation();
  const supportsHistory = isGitProvider(repoType) && isLegacyStorage;

  const createSyncJob = async (options?: { history?: boolean }) => {
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
            migrate: {
              history: (options?.history || false) && supportsHistory,
            },
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

      setStepStatusInfo?.({ status: 'success' });
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
    supportsHistory,
  };
}
