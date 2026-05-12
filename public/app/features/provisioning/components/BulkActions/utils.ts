import { type Folder } from 'app/api/clients/folder/v1beta1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { type DashboardTreeSelection } from 'app/features/browse-dashboards/types';
import { type WorkflowOption } from 'app/features/provisioning/types';

import { joinPath } from '../utils/path';

export type BulkActionFormData = {
  comment: string;
  ref: string;
  workflow?: WorkflowOption;
  targetFolderUID?: string;
};

export interface BulkActionProvisionResourceProps {
  folderUid?: string;
  selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>;
  onActionComplete?: () => void;
  onDismiss?: () => void;
}

/**
 * @example
 * // Whole instance provisioned (root)
 * getTargetFolderPathInRepo({ targetFolderUID: '' }) // returns "/"
 *
 * // Repository root folder
 * getTargetFolderPathInRepo(...) // returns "/"
 *
 * // Nested folder
 * getTargetFolderPathInRepo(...) // returns "path/to/folder/"
 */

type GetTargetFolderPathInRepoParams = {
  targetFolderUID?: string;
  targetFolder?: Folder;
  repoName?: string;
  hidePrependSlash?: boolean;
};

export function getTargetFolderPathInRepo({
  targetFolderUID,
  targetFolder,
  repoName,
  hidePrependSlash = false,
}: GetTargetFolderPathInRepoParams): string | undefined {
  const ROOT_PATH = '/';
  const EMPTY_ROOT_PATH = ''; // this is used to prevent duplicate "/" in url

  // Case 1: Whole instance is provisioned and no folder uid passed in (empty UID indicates root)
  if (targetFolderUID === '') {
    return hidePrependSlash ? EMPTY_ROOT_PATH : ROOT_PATH;
  }

  // Case 2: Target folder is the repository root folder
  if (isRepositoryRootFolder(targetFolder, repoName)) {
    return hidePrependSlash ? EMPTY_ROOT_PATH : ROOT_PATH;
  }

  // Case 3: Regular folder with source path annotation
  return getNestedFolderPath(targetFolder);
}

/**
 * Checks if the target folder is the repository root folder
 */
function isRepositoryRootFolder(targetFolder?: Folder, repoName?: string) {
  return Boolean(targetFolder?.metadata?.name === repoName && repoName);
}

/**
 * Gets the path for a nested folder from its annotations
 */
export function getNestedFolderPath(targetFolder?: Folder): string | undefined {
  if (!targetFolder) {
    return undefined;
  }
  const folderAnnotations = targetFolder?.metadata?.annotations || {};
  const sourcePath = folderAnnotations[AnnoKeySourcePath] || '';

  return sourcePath ? joinPath(sourcePath, '') : '/';
}

export function getResourceTargetPath(currentPath: string, targetFolderPath: string): string {
  // Handle folder paths that end with '/'
  const cleanCurrentPath = currentPath.replace(/\/$/, ''); // Remove trailing slash
  const filename = cleanCurrentPath.split('/').pop();

  if (!filename) {
    throw new Error(`Invalid path: ${currentPath}`);
  }

  const isFolder = currentPath.endsWith('/');
  const basePath = joinPath(targetFolderPath, filename);
  return isFolder ? `${basePath}/` : basePath;
}

function normalizeRepoPath(path: string): string {
  return path.replace(/^\/+/, '').replace(/\/+$/, '');
}

export function isResourceAlreadyInTarget(currentPath: string, targetFolderPath: string): boolean {
  return normalizeRepoPath(currentPath) === normalizeRepoPath(getResourceTargetPath(currentPath, targetFolderPath));
}

export function isSameFolderPath(currentFolderPath: string | undefined, targetFolderPath: string): boolean {
  return normalizeRepoPath(currentFolderPath || '') === normalizeRepoPath(targetFolderPath);
}
