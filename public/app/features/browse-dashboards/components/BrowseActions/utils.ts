import { t } from '@grafana/i18n';
import { config, getBackendSrv } from '@grafana/runtime';
import {
  RepositoryView,
  ResourceWrapper,
  Unstructured,
  useCreateRepositoryFilesWithPathMutation,
  useDeleteRepositoryFilesWithPathMutation,
} from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { BaseProvisionedFormData } from 'app/features/dashboard-scene/saving/shared';

import { DashboardTreeSelection } from '../../types';

export function buildBreakdownString(
  folderCount: number,
  dashboardCount: number,
  libraryPanelCount: number,
  alertRuleCount: number
) {
  const total = folderCount + dashboardCount + libraryPanelCount + alertRuleCount;
  const parts = [];
  if (folderCount) {
    parts.push(t('browse-dashboards.counts.folder', '{{count}} folder', { count: folderCount }));
  }
  if (dashboardCount) {
    parts.push(t('browse-dashboards.counts.dashboard', '{{count}} dashboard', { count: dashboardCount }));
  }
  if (libraryPanelCount) {
    parts.push(t('browse-dashboards.counts.libraryPanel', '{{count}} library panel', { count: libraryPanelCount }));
  }
  if (alertRuleCount) {
    parts.push(t('browse-dashboards.counts.alertRule', '{{count}} alert rule', { count: alertRuleCount }));
  }
  let breakdownString = t('browse-dashboards.counts.total', '{{count}} item', { count: total });
  if (parts.length > 0) {
    breakdownString += `: ${parts.join(', ')}`;
  }
  return breakdownString;
}

type MoveResourceMutations = {
  createFile: ReturnType<typeof useCreateRepositoryFilesWithPathMutation>[0];
  deleteFile: ReturnType<typeof useDeleteRepositoryFilesWithPathMutation>[0];
};
interface BulkMoveRequest {
  selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>;
  targetFolderPath: string;
  repository: RepositoryView;
  mutations: MoveResourceMutations;
  options: BaseProvisionedFormData;
}

interface MoveResultSuccess {
  uid: string;
  status: 'success';
}

interface MoveResultFailed {
  uid: string;
  status: 'failed';
  title?: string;
  failureType: 'create' | 'delete' | 'data-fetch';
  error?: string;
}

export interface BulkMoveResult {
  successful: MoveResultSuccess[];
  failed: MoveResultFailed[];
  summary: {
    total: number;
    successCount: number;
    failedCount: number;
  };
}

interface FulfilledResource {
  uid: string;
  data: ResourceWrapper;
  title: string;
}

/**
 * Execute bulk move operation for selected dashboards
 * TODO: Follow up https://github.com/grafana/git-ui-sync-project/issues/315#issuecomment-3075920997 for better approach
 */
export const bulkMoveResources = async ({
  selectedItems,
  targetFolderPath,
  repository,
  mutations,
  options,
}: BulkMoveRequest): Promise<BulkMoveResult> => {
  // 1. Get dashboard data for all selected dashboards
  const dashboardsToMove = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);

  const dashboardDataResults = await Promise.allSettled(
    dashboardsToMove.map(async (uid) => {
      try {
        const dto = await getDashboardAPI().getDashboardDTO(uid);
        const sourcePath =
          'meta' in dto
            ? dto.meta.k8s?.annotations?.[AnnoKeySourcePath] || dto.meta.provisionedExternalId
            : dto.metadata?.annotations?.[AnnoKeySourcePath];

        if (!sourcePath) {
          throw new Error(`No source path found for dashboard ${uid}`);
        }

        const baseUrl = `/apis/provisioning.grafana.app/v0alpha1/namespaces/${config.namespace}`;
        const url = `${baseUrl}/repositories/${repository.name}/files/${sourcePath}`;
        const fileResponse = await getBackendSrv().get(url);

        return {
          uid,
          data: fileResponse,
          title: 'dashboard' in dto ? dto.dashboard.title : dto.spec?.title || 'Unknown',
        };
      } catch (error) {
        console.error(`Failed to get dashboard data for ${uid}:`, error);
        throw error;
      }
    })
  );

  // 2. Filter successful data fetches
  const { fulfilledResources, dataFetchFailures } = dashboardDataResults.reduce<{
    fulfilledResources: FulfilledResource[];
    dataFetchFailures: MoveResultFailed[];
  }>(
    (acc, result, index) => {
      if (result.status === 'fulfilled') {
        acc.fulfilledResources.push(result.value);
      } else {
        acc.dataFetchFailures.push({
          uid: dashboardsToMove[index],
          status: 'failed',
          failureType: 'data-fetch',
        });
      }
      return acc;
    },
    {
      fulfilledResources: [],
      dataFetchFailures: [],
    }
  );

  // 3. Execute moves for dashboards with valid data
  // In the executeBulkMove function, replace the move logic:
  const moveResults = await Promise.allSettled(
    fulfilledResources.map(async ({ uid, data, title }): Promise<MoveResultSuccess | MoveResultFailed> => {
      try {
        const fileName = formatFileName(data);
        const newPath = formatFilePath(targetFolderPath, fileName);
        const body = data.resource.file;

        if (!body) {
          throw new Error(`No file content found for dashboard ${uid}`);
        }

        const result = await moveResource({
          repositoryName: repository.name,
          currentPath: `${options.path}/${fileName}`,
          targetPath: newPath,
          fileContent: body,
          commitMessage: options.comment || `Move dashboard: ${title || uid}`,
          ref: options.workflow === 'write' ? undefined : options.ref,
          mutations,
        });

        if (result.success) {
          return {
            uid,
            status: 'success',
          };
        } else {
          throw new Error(result.error || 'Move operation failed');
        }
      } catch (error) {
        console.error(`Failed to move dashboard ${uid}:`, error);
        return {
          uid,
          status: 'failed',
          failureType: 'create',
        };
      }
    })
  );

  // 4. Process results
  const successful: MoveResultSuccess[] = [];
  const failed: MoveResultFailed[] = [...dataFetchFailures];

  moveResults.forEach((result) => {
    if (result.status === 'fulfilled') {
      if (result.value.status === 'success') {
        successful.push(result.value);
      } else {
        failed.push(result.value);
      }
    } else {
      const failedResult: MoveResultFailed = {
        uid: 'unknown',
        status: 'failed',
        failureType: 'data-fetch',
      };
      failed.push(failedResult);
    }
  });

  const summary = {
    total: dashboardsToMove.length,
    successCount: successful.length,
    failedCount: failed.length,
  };

  return {
    successful,
    failed,
    summary,
  };
};

export interface MoveResourceResult {
  success: boolean;
  failedToCreate?: boolean;
  failedToDelete?: boolean; // Created but not deleted
  error?: string;
}

// Single resource move operation
export interface MoveResourceParams {
  repositoryName: string;
  currentPath: string;
  targetPath: string;
  fileContent: Unstructured;
  commitMessage: string;
  ref?: string;
  mutations: MoveResourceMutations;
}

export async function moveResource({
  repositoryName,
  currentPath,
  targetPath,
  fileContent,
  commitMessage,
  ref,
  mutations,
}: MoveResourceParams): Promise<MoveResourceResult> {
  // Step 1: Create file at target location
  try {
    await mutations
      .createFile({
        name: repositoryName,
        path: targetPath,
        ref,
        message: commitMessage,
        body: fileContent,
      })
      .unwrap();
  } catch (error) {
    return {
      success: false,
      failedToCreate: true,
      error: error instanceof Error ? error.message : 'Create failed',
    };
  }

  // Step 2: Delete file from current location
  try {
    await mutations
      .deleteFile({
        name: repositoryName,
        path: currentPath,
        ref,
        message: commitMessage,
      })
      .unwrap();

    return { success: true }; // Only return true if both create and delete succeed
  } catch (deleteError) {
    // Partial success: created but couldn't delete
    return {
      success: false,
      failedToDelete: true,
      error: deleteError instanceof Error ? deleteError.message : 'Delete failed',
    };
  }
}

function formatFileName(data: ResourceWrapper) {
  const fileName = data.resource?.dryRun?.metadata?.annotations?.[AnnoKeySourcePath];
  if (!fileName) {
    throw new Error('Missing source path annotation');
  }
  return fileName.split('/').pop();
}

function formatFilePath(path: string, fileName: string | undefined) {
  if (!fileName) {
    throw new Error('File name is required to format file path');
  }
  return `${path.replace(/\/$/, '')}/${fileName}`;
}
