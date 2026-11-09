import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { collectionsAPIv1alpha1 } from 'app/api/clients/collections/v1alpha1';
import { dashboardAPIv0alpha1 } from 'app/api/clients/dashboard/v0alpha1';
import { legacyAPI } from 'app/api/clients/legacy';
import { contextSrv } from 'app/core/services/context_srv';
import { STARRED_FOLDERS_UID, TEAM_FOLDERS_UID, isRootFolderUID } from 'app/features/search/constants';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type NestedFolderDTO } from 'app/features/search/service/types';
import { extractManagerId, extractManagerKind, queryResultToViewItem } from 'app/features/search/service/utils';
import { type DashboardViewItem } from 'app/features/search/types';
import { resolveStarredFolders } from 'app/features/stars/folders';
import { findStarredNames, userStarsFieldSelector } from 'app/features/stars/utils';
import { AccessControlAction } from 'app/types/accessControl';
import { dispatch } from 'app/types/store';

import {
  addStarredFolderPrefix,
  addTeamFolderPrefix,
  getFolderURL,
  isSharedWithMe,
  isVirtualStarredFolder,
  isVirtualTeamFolder,
  parseOwnerRef,
  teamOwnerRef,
} from '../utils/dashboards';

import { PAGE_SIZE } from './constants';

async function searchFolders(parentUID?: string, page = 1, pageSize = PAGE_SIZE): Promise<NestedFolderDTO[]> {
  const results = await getGrafanaSearcher().search({
    kind: ['folder'],
    location: parentUID || 'general',
    from: (page - 1) * pageSize, // our pages are 1-indexed, so we need to -1 to convert that to correct value to skip
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  const folders = results.view
    .toArray()
    .map<NestedFolderDTO>(({ uid, name, managedBy }) => ({ uid, title: name, managedBy }));

  // Virtual roots only at the top level (first page, no parent), ahead of the real folders.
  if (page !== 1 || parentUID) {
    return folders;
  }
  // Shared with me isn't returned by the API, so it's added statically and shown whether or not it
  // has children, as in the folder picker.
  const virtualRoots: NestedFolderDTO[] = [
    ...(config.sharedWithMeFolderUID
      ? [{ uid: config.sharedWithMeFolderUID, title: t('browse-dashboards.shared-with-me', 'Shared with me') }]
      : []),
    { uid: TEAM_FOLDERS_UID, title: t('browse-dashboards.my-team-folders', 'My team folders') },
    { uid: STARRED_FOLDERS_UID, title: t('browse-dashboards.starred-folders', 'Starred folders') },
  ];
  return [...virtualRoots, ...folders];
}

export async function listFolders(
  parentUID?: string,
  parentTitle?: string, // TODO: remove this when old UI is gone
  page = 1,
  pageSize = PAGE_SIZE
): Promise<DashboardViewItem[]> {
  let folders: NestedFolderDTO[] = [];
  if (contextSrv.hasPermission(AccessControlAction.FoldersRead)) {
    folders = await searchFolders(parentUID, page, pageSize);
  }

  return folders.map(({ uid, title, managedBy }) => {
    const noUrl = isSharedWithMe(uid) || isVirtualTeamFolder(uid) || isVirtualStarredFolder(uid);
    return {
      kind: 'folder',
      uid,
      title,
      parentTitle,
      parentUID,
      managedBy: extractManagerKind(managedBy),
      managerId: extractManagerId(managedBy),
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

    // TODO: Once we remove nestedFolders feature flag, undo this and prevent
    // the "general" parentUID from being set in searcher. Until then, treat
    // any root sentinel ("" or "general") as "no parent" for the UI.
    if (isRootFolderUID(viewItem.parentUID)) {
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

/**
 * Reads the user's explicitly-starred folders from the collections stars API and resolves them to
 * folder items directly under the virtual "Starred folders" root. Returns prefixed UIDs so the browse
 * tree keeps independent expand/collapse state from the same folder elsewhere in the tree.
 */
export async function listStarredFolders(): Promise<DashboardViewItem[]> {
  // For browse dashboards the caching is mostly handled in the custom redux slice and for it to work we need requests
  // here not to be cached.
  const stars = await dispatch(
    collectionsAPIv1alpha1.endpoints.listStars.initiate(
      { fieldSelector: userStarsFieldSelector() },
      { forceRefetch: true }
    )
  ).unwrap();

  const folders = await resolveStarredFolders(findStarredNames(stars, 'folder.grafana.app', 'Folder'));
  return folders.map((folder) => ({
    kind: 'folder' as const,
    // Prefixed UID for independent tree state; the real UID drives the folder URL and picker selection.
    uid: addStarredFolderPrefix(folder.uid),
    title: folder.title,
    parentUID: STARRED_FOLDERS_UID,
    url: getFolderURL(folder.uid),
  }));
}
