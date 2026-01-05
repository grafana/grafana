import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import impressionSrv from 'app/core/services/impression_srv';
import { ResourceRef } from 'app/features/provisioning/components/BulkActions/useBulkActionJob';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { DashboardQueryResult } from 'app/features/search/service/types';

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

/**
 * Returns dashboard search results ordered the same way the user opened them.
 */
export async function getRecentlyViewedDashboards(maxItems = 5): Promise<DashboardQueryResult[]> {
  try {
    const recentlyOpened = (await impressionSrv.getDashboardOpened()).slice(0, maxItems);
    if (!recentlyOpened.length) {
      return [];
    }

    const searchResults = await getGrafanaSearcher().search({
      kind: ['dashboard'],
      limit: recentlyOpened.length,
      uid: recentlyOpened,
    });

    const dashboards = searchResults.view.toArray();
    // Keep dashboards in the same order the user opened them.
    // When a UID is missing from the search response
    // push it to the end instead of letting indexOf return -1
    const order = (uid: string) => {
      const idx = recentlyOpened.indexOf(uid);
      return idx === -1 ? recentlyOpened.length : idx;
    };

    dashboards.sort((a, b) => order(a.uid) - order(b.uid));
    return dashboards;
  } catch (error) {
    console.error('Failed to load recently viewed dashboards', error);
    return [];
  }
}
