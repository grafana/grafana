import { t } from '@grafana/i18n';
import { config, getBackendSrv } from '@grafana/runtime';
import { dashboardAPIv0alpha1 } from 'app/api/clients/dashboard/v0alpha1';
import { legacyAPI } from 'app/api/clients/legacy';
import { contextSrv } from 'app/core/services/context_srv';
import { GENERAL_FOLDER_UID, TEAM_FOLDERS_UID } from 'app/features/search/constants';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult, type NestedFolderDTO } from 'app/features/search/service/types';
import { extractManagerKind, queryResultToViewItem } from 'app/features/search/service/utils';
import { type DashboardViewItem } from 'app/features/search/types';
import { AccessControlAction } from 'app/types/accessControl';
import { dispatch } from 'app/types/store';

import {
  addTeamFolderPrefix,
  getFolderURL,
  isSharedWithMe,
  isVirtualTeamFolder,
  parseOwnerRef,
  teamOwnerRef,
} from '../utils/dashboards';

import { PAGE_SIZE } from './constants';

async function searchOldAPI(parentUID?: string, page = 1, pageSize = PAGE_SIZE) {
  const backendSrv = getBackendSrv();
  return await backendSrv.get<NestedFolderDTO[]>('/api/folders', {
    parentUid: parentUID,
    page,
    limit: pageSize,
  });
}

const virtualFolderBase = {
  kind: 'folder',
  url: '',
  panel_type: '',
  tags: [],
  location: '',
  ds_uid: [],
  score: 0,
  explain: {},
};

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
  if (page === 1 && !parentUID && config.sharedWithMeFolderUID) {
    folders.unshift({
      ...virtualFolderBase,
      uid: config.sharedWithMeFolderUID,
      name: t('browse-dashboards.shared-with-me', 'Shared with me'),
    });
  }

  // Add team folders virtual item
  if (page === 1 && !parentUID && config.featureToggles.teamFolders) {
    const insertIndex = config.sharedWithMeFolderUID ? 1 : 0;
    folders.splice(insertIndex, 0, {
      ...virtualFolderBase,
      name: t('browse-dashboards.my-team-folders', 'My team folders'),
      uid: TEAM_FOLDERS_UID,
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

  return folders.map(({ uid, title, managedBy }) => {
    const noUrl = isSharedWithMe(uid) || isVirtualTeamFolder(uid);
    return {
      kind: 'folder',
      uid,
      title,
      parentTitle,
      parentUID,
      managedBy: extractManagerKind(managedBy),
      url: noUrl
        ? undefined
        : // URLs from the backend come with subUrlPrefix already included, so match that behaviour here
          getFolderURL(uid),
    };
  });
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

/**
 * Fetches the user's teams and returns actual folder items directly under "Team folders",
 * with team owner info attached to each folder.
 */
export async function listTeamFolders(): Promise<DashboardViewItem[]> {
  // For browse dashboards the caching is mostly handled in the custom redux slice and for it to work we need requests
  // here not to be cached.

  const teams = await dispatch(
    legacyAPI.endpoints.getSignedInUserTeamList.initiate(undefined, { forceRefetch: true })
  ).unwrap();

  if (!teams || teams.length === 0) {
    return [];
  }

  const ownerReference = teams.map(teamOwnerRef);

  const result = await dispatch(
    dashboardAPIv0alpha1.endpoints.searchDashboardsAndFolders.initiate(
      {
        ownerReference,
        type: 'folder',
      },
      {
        forceRefetch: true,
      }
    )
  ).unwrap();

  const hits = result.hits ?? [];
  if (hits.length === 0) {
    return [];
  }

  // Build a map of team UID → team info
  const teamsByUid = new Map(teams.map((team) => [team.uid, { name: team.name, avatarUrl: team.avatarUrl }]));

  // Build a map of folder UID → owning team reference
  const folderOwners = new Map<string, { kind: string; uid: string; title: string; avatarUrl?: string }>();
  for (const hit of hits) {
    for (const ref of hit.ownerReferences ?? []) {
      const parsed = parseOwnerRef(ref);
      if (!parsed) {
        continue;
      }
      const team = teamsByUid.get(parsed.uid);
      if (team) {
        folderOwners.set(hit.name, {
          kind: parsed.kind,
          uid: parsed.uid,
          title: team.name,
          avatarUrl: team.avatarUrl,
        });
      }
    }
  }

  // Return actual folders with owner reference info
  return hits.map((hit) => ({
    kind: 'folder' as const,
    // Use prefixed UIDs so expansion state doesn't collide with the same folder elsewhere in the tree
    uid: addTeamFolderPrefix(hit.name),
    title: hit.title,
    parentUID: TEAM_FOLDERS_UID,
    url: getFolderURL(hit.name),
    ownerReference: folderOwners.get(hit.name),
  }));
}
