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

export interface ProgressCallback {
  (current: number, total: number, item: string): void;
}

interface BulkMoveRequest {
  selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>;
  targetFolderPath: string;
  repository: RepositoryView;
  mutations: MoveResourceMutations;
  options: BaseProvisionedFormData;
  onProgress?: ProgressCallback;
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
 * Execute bulk move operation for selected dashboards with sequential processing
 * to avoid GitHub API conflicts and race conditions
 */
export const bulkMoveResources = async ({
  selectedItems,
  targetFolderPath,
  repository,
  mutations,
  options,
  onProgress,
}: BulkMoveRequest): Promise<BulkMoveResult> => {
  // 1. Get dashboard data for all selected dashboards (parallel reads are OK)
  const dashboardsToMove = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);

  onProgress?.(
    0,
    dashboardsToMove.length,
    t('browse-dashboards.bulk-move.fetching-data', 'Fetching dashboard data...')
  );

  const dashboardDataResults = await Promise.allSettled(
    dashboardsToMove.map(async (uid) => {
      try {
        const dto = await getDashboardAPI().getDashboardDTO(uid);
        const sourcePath =
          'meta' in dto
            ? dto.meta.k8s?.annotations?.[AnnoKeySourcePath] || dto.meta.provisionedExternalId
            : dto.metadata?.annotations?.[AnnoKeySourcePath];

        if (!sourcePath) {
          throw new Error(
            t('browse-dashboards.bulk-move.no-source-path', 'No source path found for dashboard {{uid}}', { uid })
          );
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
          error: result.reason instanceof Error ? result.reason.message : 'Data fetch failed',
        });
      }
      return acc;
    },
    {
      fulfilledResources: [],
      dataFetchFailures: [],
    }
  );

  // 3. Sequential processing for write operations to avoid GitHub API conflicts
  const successful: MoveResultSuccess[] = [];
  const failed: MoveResultFailed[] = [...dataFetchFailures];

  for (const [index, { uid, data, title }] of fulfilledResources.entries()) {
    try {
      const currentStep = index + 1;
      const totalSteps = fulfilledResources.length;

      onProgress?.(
        currentStep,
        totalSteps,
        t('browse-dashboards.bulk-move.moving-dashboard', 'Moving "{{title}}"', { title })
      );

      const fileName = formatFileName(data);
      const newPath = formatFilePath(targetFolderPath, fileName);
      const body = data.resource.file;

      if (!body) {
        throw new Error(
          t('browse-dashboards.bulk-move.no-file-content', 'No file content found for dashboard {{uid}}', { uid })
        );
      }

      const result = await moveResource({
        repositoryName: repository.name,
        currentPath: formatFilePath(options.path, fileName),
        targetPath: newPath,
        fileContent: body,
        commitMessage: options.comment || `Move dashboard: ${title}`,
        ref: options.workflow === 'write' ? undefined : options.ref,
        mutations,
      });

      if (result.success) {
        successful.push({
          uid,
          status: 'success',
        });
        console.log(`✅ Successfully moved dashboard: ${title} (${uid})`);
      } else {
        throw new Error(result.error || t('browse-dashboards.bulk-move.move-failed', 'Move operation failed'));
      }

      // Add delay between operations to prevent GitHub API rate limits and conflicts
      if (index < fulfilledResources.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300)); // 300ms delay
      }
    } catch (error) {
      console.error(`❌ Failed to move dashboard ${uid}:`, error);
      failed.push({
        uid,
        status: 'failed',
        title,
        failureType: 'create',
        error: error instanceof Error ? error.message : t('browse-dashboards.bulk-move.unknown-error', 'Unknown error'),
      });
    }
  }

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
  failedToDelete?: boolean;
  error?: string;
}

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
  console.log(`🚀 Moving file: ${currentPath} → ${targetPath}`);

  // Step 1: Create file at target location
  try {
    await mutations
      .createFile({
        name: repositoryName,
        path: targetPath,
        ref,
        message: `Bulk action (move) - ${commitMessage}`,
        body: fileContent,
      })
      .unwrap();
    console.log(`✅ Created file at: ${targetPath}`);
  } catch (error) {
    console.error(`❌ Failed to create file at ${targetPath}:`, error);
    return {
      success: false,
      failedToCreate: true,
      error: error instanceof Error ? error.message : t('browse-dashboards.bulk-move.create-failed', 'Create failed'),
    };
  }

  // Step 2: Delete file from current location
  try {
    await mutations
      .deleteFile({
        name: repositoryName,
        path: currentPath,
        ref,
        message: `Bulk action (delete) - ${commitMessage}`,
      })
      .unwrap();
    console.log(`✅ Deleted file from: ${currentPath}`);
    return { success: true };
  } catch (deleteError) {
    console.error(`❌ Failed to delete file from ${currentPath}:`, deleteError);
    return {
      success: false,
      failedToDelete: true,
      error:
        deleteError instanceof Error
          ? deleteError.message
          : t('browse-dashboards.bulk-move.delete-failed', 'Delete failed'),
    };
  }
}

function formatFileName(data: ResourceWrapper) {
  const fileName = data.resource?.dryRun?.metadata?.annotations?.[AnnoKeySourcePath];
  if (!fileName) {
    throw new Error(t('browse-dashboards.bulk-move.missing-source-path', 'Missing source path annotation'));
  }
  return fileName.split('/').pop();
}

function formatFilePath(path: string | undefined, fileName: string | undefined) {
  if (!fileName) {
    throw new Error(t('browse-dashboards.bulk-move.filename-required', 'File name is required to format file path'));
  }

  // Handle root folder cases (undefined, empty, or just "/")
  const safePath = path || '';
  const cleanPath = safePath.replace(/^\/+|\/+$/g, ''); // Remove leading AND trailing slashes

  // For root folder, return just the filename, otherwise folder/filename
  return cleanPath ? `${cleanPath}/${fileName}` : fileName;
}
