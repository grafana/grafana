import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, FolderDTO } from 'app/types';

function checkFolderPermission(action: AccessControlAction, folderDTO?: FolderDTO) {
  return folderDTO ? contextSrv.hasPermissionInMetadata(action, folderDTO) : contextSrv.hasPermission(action);
}

function checkCanCreateFolders(folderDTO?: FolderDTO) {
  // Can only create a folder if we have permissions and either we're at root or nestedFolders is enabled
  if (folderDTO && !config.featureToggles.nestedFolders) {
    return false;
  }

  if (!config.featureToggles.accessActionSets) {
    if (!folderDTO || folderDTO.uid === 'general') {
      return checkFolderPermission(AccessControlAction.FoldersCreate);
    }
    return (
      checkFolderPermission(AccessControlAction.FoldersCreate) &&
      checkFolderPermission(AccessControlAction.FoldersWrite, folderDTO)
    );
  }

  return checkFolderPermission(AccessControlAction.FoldersCreate, folderDTO);
}

export function getFolderPermissions(folderDTO?: FolderDTO) {
  const canCreateDashboards = checkFolderPermission(AccessControlAction.DashboardsCreate, folderDTO);
  const canCreateFolders = checkCanCreateFolders(folderDTO);
  const canDeleteFolders = checkFolderPermission(AccessControlAction.FoldersDelete, folderDTO);
  const canEditDashboards = checkFolderPermission(AccessControlAction.DashboardsWrite, folderDTO);
  const canEditFolders = checkFolderPermission(AccessControlAction.FoldersWrite, folderDTO);
  const canSetPermissions = checkFolderPermission(AccessControlAction.FoldersPermissionsWrite, folderDTO);
  const canViewPermissions = checkFolderPermission(AccessControlAction.FoldersPermissionsRead, folderDTO);

  return {
    canCreateDashboards,
    canCreateFolders,
    canDeleteFolders,
    canEditDashboards,
    canEditFolders,
    canSetPermissions,
    canViewPermissions,
  };
}
