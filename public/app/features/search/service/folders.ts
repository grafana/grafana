import { getBackendSrv } from '@grafana/runtime';
import config from 'app/core/config';

import { DashboardViewItem } from '../types';

import { getGrafanaSearcher } from './searcher';
import { NestedFolderDTO } from './types';
import { queryResultToViewItem } from './utils';

export async function getFolderChildren(
  parentUid?: string,
  parentTitle?: string,
  dashboardsAtRoot = false
): Promise<DashboardViewItem[]> {
  if (!config.featureToggles.nestedFolders) {
    console.error('getFolderChildren requires nestedFolders feature toggle');
    return [];
  }

  if (!dashboardsAtRoot && !parentUid) {
    // We don't show dashboards at root in folder view yet - they're shown under a dummy 'general'
    // folder that FolderView adds in
    const folders = await getChildFolders();
    return folders;
  }

  const searcher = getGrafanaSearcher();
  const dashboardsResults = await searcher.search({
    kind: ['dashboard'],
    query: '*',
    location: parentUid ?? 'general',
    limit: 1000,
  });

  const dashboardItems = dashboardsResults.view.map((item) => {
    return queryResultToViewItem(item, dashboardsResults.view);
  });

  const folders = await getChildFolders(parentUid, parentTitle);

  return [...folders, ...dashboardItems];
}

async function getChildFolders(parentUid?: string, parentTitle?: string): Promise<DashboardViewItem[]> {
  const backendSrv = getBackendSrv();

  const folders = await backendSrv.get<NestedFolderDTO[]>('/api/folders', { parentUid });

  return folders.map((item) => ({
    kind: 'folder',
    uid: item.uid,
    title: item.title,
    parentTitle,
    url: `/dashboards/f/${item.uid}/`,
  }));
}
