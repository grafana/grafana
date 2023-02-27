import { config, getBackendSrv } from '@grafana/runtime';

import { DashboardViewItem } from '../types';

import { getGrafanaSearcher } from './searcher';
import { NestedFolderDTO } from './types';
import { queryResultToViewItem } from './utils';

export async function getFolderChildren(parentUid?: string): Promise<DashboardViewItem[]> {
  if (!config.featureToggles.nestedFolders) {
    throw new Error('PR TODO: Require nestedFolders enabled');
  }

  if (!parentUid) {
    // We don't show dashboards at root in folder view yet - they're shown under a dummy 'general'
    // folder that FolderView adds in
    const folders = await getChildFolders();
    return folders;
  }

  const searcher = getGrafanaSearcher();
  const dashboardsResults = await searcher.search({
    kind: ['dashboard'],
    query: '*',
    location: parentUid,
    limit: 1000,
  });

  const dashboardItems = dashboardsResults.view.map((item) => {
    return queryResultToViewItem(item, dashboardsResults.view);
  });

  const folders = await getChildFolders(parentUid);

  return [...folders, ...dashboardItems];
}

async function getChildFolders(parentUid?: string): Promise<DashboardViewItem[]> {
  const backendSrv = getBackendSrv();

  const folders = await backendSrv.get<NestedFolderDTO[]>('/api/folders', { parentUid });

  return folders.map((item) => ({
    kind: 'folder',
    uid: item.uid,
    title: item.title,
    url: `/dashboards/f/${item.uid}/`,
  }));
}
