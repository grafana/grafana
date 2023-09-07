import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, FolderDTO } from 'app/types';

function checkFolderPermission(action: AccessControlAction, fallback: boolean, folderDTO?: FolderDTO) {
  return folderDTO
    ? contextSrv.hasAccessInMetadata(action, folderDTO, fallback)
    : contextSrv.hasAccess(action, fallback);
}

export function getFolderPermissions(folderDTO?: FolderDTO) {
  // It is possible to have edit permissions for folders and dashboards, without being able to save, hence 'canSave'
  const canEditInFolderFallback = folderDTO ? folderDTO.canSave : contextSrv.hasEditPermissionInFolders;

  const canEditInFolder = checkFolderPermission(AccessControlAction.FoldersWrite, canEditInFolderFallback, folderDTO);
  // Can only create a folder if at root or nestedFolders is enabled and we have permission
  const canCreateFolder =
    !folderDTO ||
    Boolean(
      config.featureToggles.nestedFolders &&
        checkFolderPermission(AccessControlAction.FoldersCreate, contextSrv.isEditor)
    );
  const canCreateDashboards = checkFolderPermission(
    AccessControlAction.DashboardsCreate,
    canEditInFolderFallback || !!folderDTO?.canSave
  );

  return {
    canEditInFolder,
    canCreateDashboards,
    canCreateFolder,
  };
}
