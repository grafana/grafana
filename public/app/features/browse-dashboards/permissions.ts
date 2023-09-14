import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, FolderDTO } from 'app/types';

function checkFolderPermission(action: AccessControlAction, folderDTO?: FolderDTO) {
  return folderDTO ? contextSrv.hasPermissionInMetadata(action, folderDTO) : contextSrv.hasPermission(action);
}

export function getFolderPermissions(folderDTO?: FolderDTO) {
  const canEditFolder = checkFolderPermission(AccessControlAction.FoldersWrite, folderDTO);
  // Can only create a folder if we have permissions and either we're at root or nestedFolders is enabled
  const canCreateFolder = Boolean(
    (!folderDTO || config.featureToggles.nestedFolders) && checkFolderPermission(AccessControlAction.FoldersCreate)
  );
  const canCreateDashboards = checkFolderPermission(AccessControlAction.DashboardsCreate, folderDTO);
  const canDeleteFolder = checkFolderPermission(AccessControlAction.FoldersDelete, folderDTO);
  const canViewPermissions = checkFolderPermission(AccessControlAction.FoldersPermissionsRead, folderDTO);
  const canSetPermissions = checkFolderPermission(AccessControlAction.FoldersPermissionsWrite, folderDTO);

  return {
    canCreateDashboards,
    canCreateFolder,
    canDeleteFolder,
    canEditFolder,
    canSetPermissions,
    canViewPermissions,
  };
}
