import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';

import { withSavedByTrailer } from '../../utils/currentUser';
import { type StepStatusInfo } from '../types';

export interface UseCreateSyncJobParams {
  repoName: string;
  setStepStatusInfo?: (info: StepStatusInfo) => void;
}

export function useCreateSyncJob({ repoName, setStepStatusInfo }: UseCreateSyncJobParams) {
  const [createJob, { isLoading }] = useCreateRepositoryJobsMutation();

  const createSyncJob = useCallback(
    async (requiresMigration: boolean, options?: { skipStatusUpdates?: boolean }) => {
      const { skipStatusUpdates = false } = options || {};

      if (!repoName) {
        if (!skipStatusUpdates) {
          setStepStatusInfo?.({
            status: 'error',
            error: t('provisioning.sync-job.error-no-repository-name', 'No repository name provided'),
          });
        }
        return null;
      }

      try {
        if (!skipStatusUpdates) {
          setStepStatusInfo?.({ status: 'running' });
        }

        const jobSpec = requiresMigration
          ? {
              action: 'migrate' as const,
              migrate: {
                message: withSavedByTrailer(
                  t('provisioning.sync-job.migrate-default-message', 'Migrate Grafana resources into repository')
                ),
              },
            }
          : {
              action: 'pull' as const,
              // TODO(grafana/git-ui-sync-project#1162): SyncJobOptions has no
              // `message` field on the backend yet — when it gains one, append
              // the Grafana-saved-by trailer here too.
              pull: {
                incremental: false,
              },
            };

        const response = await createJob({
          name: repoName,
          jobSpec,
        }).unwrap();

        if (!response?.metadata?.name) {
          if (!skipStatusUpdates) {
            setStepStatusInfo?.({
              status: 'error',
              error: t('provisioning.sync-job.error-no-job-id', 'Failed to start job'),
            });
          }
          return null;
        }

        // Job status will be tracked by JobStatus component, keep status as 'running'
        return response;
      } catch (error) {
        if (!skipStatusUpdates) {
          const errorMessage = extractErrorMessage(error);
          setStepStatusInfo?.({
            status: 'error',
            error: {
              title: t('provisioning.sync-job.error-starting-job', 'Error starting job'),
              message: errorMessage,
            },
          });
        }
        return null;
      }
    },
    [createJob, repoName, setStepStatusInfo]
  );

  return {
    createSyncJob,
    isLoading,
  };
}
