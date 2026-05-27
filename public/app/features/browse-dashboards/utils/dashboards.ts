import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { type ResourceRef } from 'app/features/provisioning/components/BulkActions/useBulkActionJob';
import { TEAM_FOLDERS_UID } from 'app/features/search/constants';

import { type DashboardTreeSelection, type DashboardViewItemWithUIItems } from '../types';

export function makeRowID(baseId: string, item: DashboardViewItemWithUIItems) {
  return baseId + item.uid;
}

export function isSharedWithMe(uid: string) {
  return uid === config.sharedWithMeFolderUID;
}

export function isVirtualTeamFolder(uid: string) {
  return uid === TEAM_FOLDERS_UID;
}

const TEAM_FOLDER_PREFIX = TEAM_FOLDERS_UID + '/';

export function isUnderTeamFolders(uid: string) {
  return uid.startsWith(TEAM_FOLDER_PREFIX);
}

export function addTeamFolderPrefix(uid: string) {
  return TEAM_FOLDER_PREFIX + uid;
}

export function removeTeamFolderPrefix(uid: string): string {
  if (uid.startsWith(TEAM_FOLDER_PREFIX)) {
    return uid.slice(TEAM_FOLDER_PREFIX.length);
  }
  return uid;
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

/**
 * Builds an owner-reference string for a team, e.g. `iam.grafana.app/Team/{uid}`.
 */
export function teamOwnerRef(team: { uid: string }): string {
  return `iam.grafana.app/Team/${team.uid}`;
}

/**
 * Parses an owner-reference string like `iam.grafana.app/Team/{uid}`.
 * Returns `undefined` if the string doesn't match the expected format.
 */
export function parseOwnerRef(ref: string): { kind: string; uid: string } | undefined {
  const parts = ref.split('/');
  if (parts.length !== 3 || parts[0] !== 'iam.grafana.app') {
    return undefined;
  }
  return { kind: parts[1], uid: parts[2] };
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
