import { getBackendSrv } from '@grafana/runtime';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { NestedFolderDTO } from 'app/features/search/service/types';
import { queryResultToViewItem } from 'app/features/search/service/utils';
import { DashboardViewItem } from 'app/features/search/types';
import { AccessControlAction } from 'app/types/accessControl';

import { contextSrv } from '../../../core/core';
import { getFolderURL, isSharedWithMe } from '../components/utils';

export const PAGE_SIZE = 50;

export async function listFolders(
  parentUID?: string,
  parentTitle?: string, // TODO: remove this when old UI is gone
  page = 1,
  pageSize = PAGE_SIZE
): Promise<DashboardViewItem[]> {
  if (parentUID) {
    return [];
  }

  const backendSrv = getBackendSrv();

  // TODO: what to do here for unified search?
  let folders: NestedFolderDTO[] = [];
  if (contextSrv.hasPermission(AccessControlAction.FoldersRead)) {
    folders = await backendSrv.get<NestedFolderDTO[]>('/api/folders', {
      parentUid: parentUID,
      page,
      limit: pageSize,
    });
  }

  return folders.map((item) => ({
    kind: 'folder',
    uid: item.uid,
    title: item.title,
    parentTitle,
    parentUID,
    managedBy: item.managedBy,

    // URLs from the backend come with subUrlPrefix already included, so match that behaviour here
    url: isSharedWithMe(item.uid) ? undefined : getFolderURL(item.uid),
  }));
}

export async function listDashboards(parentUID?: string, page = 1, pageSize = PAGE_SIZE): Promise<DashboardViewItem[]> {
  const searcher = getGrafanaSearcher();

  const dashboardsResults = await searcher.search({
    kind: ['dashboard'],
    query: '*',
    location: parentUID || 'general',
    from: (page - 1) * pageSize, // our pages are 1-indexed, so we need to -1 to convert that to correct value to skip
    limit: pageSize,
  });

  return dashboardsResults.view.map((item) => {
    const viewItem = queryResultToViewItem(item, dashboardsResults.view);

    // TODO: Once we remove nestedFolders feature flag, undo this and prevent the 'general'
    // parentUID from being set in searcher
    if (viewItem.parentUID === GENERAL_FOLDER_UID) {
      viewItem.parentUID = undefined;
    }

    return viewItem;
  });
}
