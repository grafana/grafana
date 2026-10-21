import { t } from '@grafana/i18n';
import {
  useCreateRepositoryJobsMutation,
  type RepositoryView,
  type Job,
  type ProvisioningResourceRef as GeneratedResourceRef,
} from 'app/api/clients/provisioning/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';

// Reuse the generated ResourceRef but require every field: a bulk delete/move job
// needs a fully-specified ref, whereas the generated fields are all optional.
export type ResourceRef = Required<GeneratedResourceRef>;

// What a job acts on. A form that knows the file path submits it directly; the backend resolves
// `resources` through the live Grafana object, which does not exist for a file that only lives on
// a branch and points at the configured branch's path after a rename on one.
type JobTargets = { paths: string[] } | { resources: ResourceRef[] };

export interface DeleteJobSpec {
  action: 'delete';
  // Commit message for the resulting git commit. Carries the Grafana-saved-by trailer.
  message?: string;
  delete: { ref?: string } & JobTargets;
}

export interface MoveJobSpec {
  action: 'move';
  // Commit message for the resulting git commit. Carries the Grafana-saved-by trailer.
  message?: string;
  move: {
    ref?: string;
    targetPath: string; // Must end with '/' slash
  } & JobTargets;
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
