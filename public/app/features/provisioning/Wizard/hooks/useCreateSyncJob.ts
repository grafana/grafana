import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { type ResourceRef, useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';

import { withSavedByTrailer } from '../../utils/currentUser';
import { type StepStatusInfo, type Target } from '../types';

export interface UseCreateSyncJobParams {
  repoName: string;
  setStepStatusInfo?: (info: StepStatusInfo) => void;
}

/** Options shared by the sync/migrate job hooks. */
export interface SyncJobOptions {
  /** Dashboard refs to scope a selective migration to; empty means migrate every unmanaged resource. */
  resources?: ResourceRef[];
  /** The repository's sync target, used to decide whether folder UIDs are regenerated on migrate. */
  syncTarget?: Target;
}

export function useCreateSyncJob({ repoName, setStepStatusInfo }: UseCreateSyncJobParams) {
  const [createJob, { isLoading }] = useCreateRepositoryJobsMutation();

  const createSyncJob = useCallback(
    async (requiresMigration: boolean, options?: SyncJobOptions & { skipStatusUpdates?: boolean }) => {
      const { skipStatusUpdates = false, resources, syncTarget } = options || {};

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
              // The Grafana-saved-by trailer rides through the top-level
              // JobSpec.Message to the resulting git commit.
              message: withSavedByTrailer(
                t('provisioning.sync-job.migrate-default-message', 'Migrate Grafana resources into repository')
              ),
              migrate: {
                // Generate fresh folder UIDs on export so the migrated folders
                // are created anew on the subsequent pull rather than taking
                // over the existing folders (which would leave their alerts and
                // library panels orphaned under a now-managed folder). Instance
                // sync is the exception: it takes over the whole instance and
                // must preserve the existing folder UIDs. Every other (and any
                // unknown) target defaults to regeneration, the safe side. Has
                // no effect unless folder metadata is written.
                generateNewFolderIDs: syncTarget !== 'instance',
                // When resources are passed, only those (unmanaged) dashboards
                // are migrated; otherwise the migrate object keeps the legacy
                // "migrate everything unmanaged" behavior the wizard relies on.
                ...(resources?.length ? { resources } : {}),
              },
            }
          : {
              action: 'pull' as const,
              // A pull replicates the remote branch locally and produces no
              // git commit, so there's no commit message to tag.
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
