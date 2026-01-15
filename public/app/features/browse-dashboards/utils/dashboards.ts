import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { ResourceRef } from 'app/features/provisioning/components/BulkActions/useBulkActionJob';

import { DashboardTreeSelection, DashboardViewItemWithUIItems } from '../types';

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
