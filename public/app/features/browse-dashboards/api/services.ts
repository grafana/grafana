import { getBackendSrv } from '@grafana/runtime';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { getGrafanaSearcher, NestedFolderDTO } from 'app/features/search/service';
import { queryResultToViewItem } from 'app/features/search/service/utils';
import { DashboardViewItem } from 'app/features/search/types';

export const PAGE_SIZE = 50;

export async function listFolders(
  parentUID?: string,
  parentTitle?: string, // TODO: remove this when old UI is gone
  page = 1,
  pageSize = PAGE_SIZE
): Promise<DashboardViewItem[]> {
  const backendSrv = getBackendSrv();

  const folders = await backendSrv.get<NestedFolderDTO[]>('/api/folders', {
    parentUid: parentUID,
    page,
    limit: pageSize,
  });

  return folders.map((item) => ({
    kind: 'folder',
    uid: item.uid,
    title: item.title,
    parentTitle,
    parentUID,
    url: `/dashboards/f/${item.uid}/`,
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
