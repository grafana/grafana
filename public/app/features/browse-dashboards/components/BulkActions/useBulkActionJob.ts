import { useCreateRepositoryJobsMutation, RepositoryView, Job } from 'app/api/clients/provisioning/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';

export interface ResourceRef {
  name: string;
  group: 'dashboard.grafana.app' | 'folder.grafana.app';
  kind: 'Dashboard' | 'Folder';
}

export interface DeleteJobSpec {
  action: 'delete';
  delete: {
    ref?: string;
    resources: ResourceRef[];
  };
}

export interface MoveJobSpec {
  action: 'move';
  move: {
    ref?: string;
    targetPath: string; // Must end with '/' slash
    resources: ResourceRef[];
  };
}

export type BulkJobSpec = DeleteJobSpec | MoveJobSpec;

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
      return { success: false, error: extractErrorMessage(error) };
    }
  };

  return {
    createBulkJob,
    isLoading,
  };
}
