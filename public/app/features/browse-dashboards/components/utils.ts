import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { ResourceRef } from 'app/features/provisioning/components/bulk-actions/useBulkActionJob';

import { DashboardTreeSelection, DashboardViewItemWithUIItems, BrowseDashboardsPermissions } from '../types';

export function makeRowID(baseId: string, item: DashboardViewItemWithUIItems) {
  return baseId + item.uid;
}

export function isSharedWithMe(uid: string) {
  return uid === config.sharedWithMeFolderUID;
}

// Construct folder URL and append orgId to it
export function getFolderURL(uid: string) {
  const { orgId } = contextSrv.user;
  const subUrlPrefix = config.appSubUrl ?? '';
  const url = `${subUrlPrefix}/dashboards/f/${uid}/`;

  if (orgId) {
    return `${url}?orgId=${orgId}`;
  }
  return url;
}

// Collect selected dashboard and folder from the DashboardTreeSelection
// This is used to prepare the items for bulk delete operation.
export function collectSelectedItems(selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>) {
  const resources: ResourceRef[] = [];

  // folders
  for (const [uid, selected] of Object.entries(selectedItems.folder)) {
    if (selected) {
      resources.push({ name: uid, group: 'folder.grafana.app', kind: 'Folder' });
    }
  }

  // dashboards
  for (const [uid, selected] of Object.entries(selectedItems.dashboard)) {
    if (selected) {
      resources.push({ name: uid, group: 'dashboard.grafana.app', kind: 'Dashboard' });
    }
  }

  return resources;
}

export function canEditItemType(itemKind: string, permissions: BrowseDashboardsPermissions) {
  const { canEditFolders, canDeleteFolders, canEditDashboards, canDeleteDashboards } = permissions;
  return itemKind === 'folder'
    ? Boolean(canEditFolders || canDeleteFolders)
    : Boolean(canEditDashboards || canDeleteDashboards);
}

export function canSelectItems(permissions: BrowseDashboardsPermissions) {
  const { canEditFolders, canDeleteFolders, canEditDashboards, canDeleteDashboards } = permissions;
  // Users can select items only if they have both edit and delete permissions for at least one item type
  const canSelectFolders = canEditFolders || canDeleteFolders;
  const canSelectDashboards = canEditDashboards || canDeleteDashboards;
  return Boolean(canSelectFolders || canSelectDashboards);
}
