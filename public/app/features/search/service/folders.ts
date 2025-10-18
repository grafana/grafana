import { listFolders } from 'app/features/browse-dashboards/api/services';

import { DashboardViewItem } from '../types';

import { getGrafanaSearcher } from './searcher';
import { queryResultToViewItem } from './utils';

export async function getFolderChildren(
  parentUid?: string,
  parentTitle?: string,
  dashboardsAtRoot = false
): Promise<DashboardViewItem[]> {
  if (!dashboardsAtRoot && !parentUid) {
    // We don't show dashboards at root in folder view yet - they're shown under a dummy 'general'
    // folder that FolderView adds in
    const folders = await listFolders();
    return folders;
  }

  const searcher = getGrafanaSearcher();
  const dashboardsResults = await searcher.search({
    kind: ['dashboard'],
    query: '*',
    location: parentUid || 'general',
    limit: 1000,
  });

  const dashboardItems = dashboardsResults.view.map((item) => {
    return queryResultToViewItem(item, dashboardsResults.view);
  });

  const folders = await listFolders(parentUid, parentTitle);

  return [...folders, ...dashboardItems];
}
