import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { AnnoKeySourcePath, ManagerKind } from 'app/features/apiserver/types';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { DashboardViewItem } from 'app/features/search/types';

import { useChildrenByParentUIDState } from '../state/hooks';
import { findItem } from '../state/utils';
import {
  DashboardTreeSelection,
  DashboardViewItemWithUIItems,
  BrowseDashboardsPermissions,
  BrowseDashboardsState,
} from '../types';

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

export function hasFolderNameCharactersToReplace(folderName: string): boolean {
  if (typeof folderName !== 'string') {
    return false;
  }

  // whitespace that needs to be replaced with hyphens
  const hasWhitespace = /\s+/.test(folderName);

  // characters that are not lowercase letters, numbers, or hyphens
  const hasInvalidCharacters = /[^a-z0-9-]/.test(folderName);

  return hasWhitespace || hasInvalidCharacters;
}

export function formatFolderName(folderName?: string): string {
  if (typeof folderName !== 'string') {
    console.error('Invalid folder name type:', typeof folderName);
    return '';
  }

  const result = folderName
    .trim() // Remove leading/trailing whitespace first
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

  // If the result is empty, return empty string
  if (result === '') {
    return '';
  }

  return result;
}

// Fetch provisioned dashboard path in repository
export async function fetchProvisionedDashboardPath(uid: string): Promise<string | undefined> {
  try {
    const dto = await getDashboardAPI().getDashboardDTO(uid);
    const sourcePath =
      'meta' in dto
        ? dto.meta.k8s?.annotations?.[AnnoKeySourcePath] || dto.meta.provisionedExternalId
        : dto.metadata?.annotations?.[AnnoKeySourcePath];
    return `${sourcePath}`;
  } catch (error) {
    console.error('Error fetching provisioned dashboard path:', error);
    return undefined;
  }
}

// Collect selected dashboard and folder from the DashboardTreeSelection
// This is used to prepare the items for bulk delete operation.
export function collectSelectedItems(
  selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>,
  childrenByParentUID: ReturnType<typeof useChildrenByParentUIDState>,
  rootItems: DashboardViewItem[] = []
) {
  const targets: Array<{ uid: string; isFolder: boolean; displayName: string }> = [];

  // folders
  for (const [uid, selected] of Object.entries(selectedItems.folder)) {
    if (selected) {
      const item = findItem(rootItems, childrenByParentUID, uid);
      targets.push({ uid, isFolder: true, displayName: item?.title || uid });
    }
  }

  // dashboards
  for (const [uid, selected] of Object.entries(selectedItems.dashboard)) {
    if (selected) {
      const item = findItem(rootItems, childrenByParentUID, uid);
      targets.push({ uid, isFolder: false, displayName: item?.title || uid });
    }
  }

  return targets;
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

/**
 * Finds the repository name for an item by traversing up the tree to find the root provisioned folder (managed by ManagerKind.Repo)
 * This should be an edge case where user have multiple provisioned folders and try to managing resources on root folder
 */
export function getItemRepositoryUid(
  item: DashboardViewItem,
  rootItems: DashboardViewItem[],
  childrenByParentUID: BrowseDashboardsState['childrenByParentUID']
): string {
  // For root provisioned folders, the UID is the repository name
  if (item.managedBy === ManagerKind.Repo && !item.parentUID && item.kind === 'folder') {
    return item.uid;
  }

  // Traverse up the tree to find the root provisioned folder
  let currentItem = item;
  while (currentItem.parentUID) {
    const parent = findItem(rootItems, childrenByParentUID, currentItem.parentUID);
    if (!parent) {
      break;
    }

    if (parent.managedBy === ManagerKind.Repo && !parent.parentUID) {
      return currentItem.parentUID;
    }

    currentItem = parent;
  }

  return 'non_provisioned';
}
