import { t } from '@grafana/i18n';
import { config, getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { DashboardQueryResult, NestedFolderDTO } from 'app/features/search/service/types';
import { extractManagerKind, queryResultToViewItem } from 'app/features/search/service/utils';
import { DashboardViewItem } from 'app/features/search/types';
import { AccessControlAction } from 'app/types/accessControl';

import { getFolderURL, isSharedWithMe } from '../utils/dashboards';

export const PAGE_SIZE = 50;

async function searchOldAPI(parentUID?: string, page = 1, pageSize = PAGE_SIZE) {
  const backendSrv = getBackendSrv();
  return await backendSrv.get<NestedFolderDTO[]>('/api/folders', {
    parentUid: parentUID,
    page,
    limit: pageSize,
  });
}

async function searchNewAPI(parentUID?: string, page = 1, pageSize = PAGE_SIZE) {
  const searcher = getGrafanaSearcher();
  const foldersResults = await searcher.search({
    kind: ['folder'],
    location: parentUID || 'general',
    from: (page - 1) * pageSize, // our pages are 1-indexed, so we need to -1 to convert that to correct value to skip
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  let folders: DashboardQueryResult[] = foldersResults.view.toArray();

  // Add shared with me item statically to the array as it is not returned from the
  // API anymore. This also means we show it every time, whether it has children or not. This is the same as in folder
  // picker for now. In the future we could to additional request to see if there are any children in it.
  if (!parentUID && config.sharedWithMeFolderUID) {
    folders.unshift({
      kind: 'folder',
      name: t('browse-dashboards.shared-with-me', 'Shared with me'),
      uid: config.sharedWithMeFolderUID,
      url: '',
      panel_type: '',
      tags: [],
      location: '',
      ds_uid: [],
      score: 0,
      explain: {},
    });
  }

  return folders.map<NestedFolderDTO>((item) => {
    return {
      uid: item.uid,
      title: item.name,
      managedBy: item.managedBy,
    };
  });
}

export async function listFolders(
  parentUID?: string,
  parentTitle?: string, // TODO: remove this when old UI is gone
  page = 1,
  pageSize = PAGE_SIZE
): Promise<DashboardViewItem[]> {
  let folders: NestedFolderDTO[] = [];
  if (contextSrv.hasPermission(AccessControlAction.FoldersRead)) {
    if (config.featureToggles.foldersAppPlatformAPI) {
      folders = await searchNewAPI(parentUID, page, pageSize);
    } else {
      folders = await searchOldAPI(parentUID, page, pageSize);
    }
  }

  return folders.map((item) => ({
    kind: 'folder',
    uid: item.uid,
    title: item.title,
    parentTitle,
    parentUID,
    managedBy: extractManagerKind(item.managedBy),
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
    offset: (page - 1) * pageSize,
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
