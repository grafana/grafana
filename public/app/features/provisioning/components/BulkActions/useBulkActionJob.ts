import { t } from '@grafana/i18n';
import { useCreateRepositoryJobsMutation, type RepositoryView, type Job } from 'app/api/clients/provisioning/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';

import { type ResourceGroup, type ResourceKindName } from '../../utils/resourceKinds';

export interface ResourceRef {
  name: string;
  group: ResourceGroup;
  kind: ResourceKindName;
}

export interface DeleteJobSpec {
  action: 'delete';
  // Commit message for the resulting git commit. Carries the Grafana-saved-by trailer.
  message?: string;
  delete: {
    ref?: string;
    resources: ResourceRef[];
  };
}

export interface MoveJobSpec {
  action: 'move';
  // Commit message for the resulting git commit. Carries the Grafana-saved-by trailer.
  message?: string;
  move: {
    ref?: string;
    targetPath: string; // Must end with '/' slash
    resources: ResourceRef[];
  };
}

type BulkJobSpec = DeleteJobSpec | MoveJobSpec;

interface UseBulkActionJobResult {
  createBulkJob: (
    repository: RepositoryView,
    jobSpec: BulkJobSpec
  ) => Promise<{
    success: boolean;
    jobId?: string;
    job?: Job; // Return the full job object
    error?: string;
  }>;
  isLoading: boolean;
}

export type ResponseType = { success: boolean; jobId?: string; job?: Job; error?: string };

// This hook is used to create bulk action (delete, move) jobs for provisioning resources
export function useBulkActionJob(): UseBulkActionJobResult {
  const [createJob, { isLoading }] = useCreateRepositoryJobsMutation();

  const createBulkJob = async (repository: RepositoryView, jobSpec: BulkJobSpec): Promise<ResponseType> => {
    try {
      const response = await createJob({
        name: repository.name,
        jobSpec,
      }).unwrap();

      const jobId = response.metadata?.name;
      return {
        success: true,
        jobId,
        job: response, // Return the full job object
      };
    } catch (error) {
      return {
        success: false,
        error: extractErrorMessage(
          error,
          t('browse-dashboards.bulk-actions.error-generic', 'Unexpected error happened when creating job')
        ),
      };
    }
  };

  return {
    createBulkJob,
    isLoading,
  };
}
