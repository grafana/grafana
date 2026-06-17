import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { contextSrv } from 'app/core/services/context_srv';
import { type ResourceRef } from 'app/features/provisioning/components/BulkActions/useBulkActionJob';
import { STARRED_FOLDERS_UID, TEAM_FOLDERS_UID } from 'app/features/search/constants';

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

export function isVirtualStarredFolder(uid: string) {
  return uid === STARRED_FOLDERS_UID;
}

const TEAM_FOLDER_PREFIX = TEAM_FOLDERS_UID + '/';

export function isUnderTeamFolders(uid: string) {
  return uid.startsWith(TEAM_FOLDER_PREFIX);
}

export function addTeamFolderPrefix(uid: string) {
  return TEAM_FOLDER_PREFIX + uid;
}

const STARRED_FOLDER_PREFIX = STARRED_FOLDERS_UID + '/';

export function addStarredFolderPrefix(uid: string) {
  return STARRED_FOLDER_PREFIX + uid;
}

// The virtual roots ("Team folders", "Starred folders") prefix their real children's UIDs so the
// browse tree keeps independent expand/collapse state from the same folder elsewhere in the tree.
const VIRTUAL_FOLDER_PREFIXES = [TEAM_FOLDER_PREFIX, STARRED_FOLDER_PREFIX];

function virtualFolderPrefixOf(uid: string): string | undefined {
  return VIRTUAL_FOLDER_PREFIXES.find((prefix) => uid.startsWith(prefix));
}

export function stripVirtualFolderPrefix(uid: string): string {
  const prefix = virtualFolderPrefixOf(uid);
  return prefix ? uid.slice(prefix.length) : uid;
}

// Re-applies whatever virtual prefix the parent carries to a freshly-fetched (unprefixed) child UID.
export function reapplyVirtualFolderPrefix(parentUID: string, childUID: string): string {
  const prefix = virtualFolderPrefixOf(parentUID);
  return prefix ? prefix + stripVirtualFolderPrefix(childUID) : childUID;
}

// Virtual roots that must never be selected, plus starred-folder children (the starred view is
// read-only; the same folders stay selectable under the real "Dashboards" tree).
export function isNonSelectableVirtualFolder(uid: string): boolean {
  return (
    isSharedWithMe(uid) ||
    isVirtualTeamFolder(uid) ||
    isVirtualStarredFolder(uid) ||
    uid.startsWith(STARRED_FOLDER_PREFIX)
  );
}

// Single gate for the starred-folders feature: the OpenFeature flag plus the hard dependency on the
// collections stars API (legacy stars are dashboard-only and cannot represent starred folders).
export function starredFoldersEnabled(): boolean {
  return (
    getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaStarredFolders, false) &&
    Boolean(config.featureToggles.starsFromAPIServer)
  );
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
