import { getBackendSrv } from '@grafana/runtime';
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
    from: page * pageSize,
    limit: pageSize,
  });

  return dashboardsResults.view.map((item) => queryResultToViewItem(item, dashboardsResults.view));
}
