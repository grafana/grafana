import { getAPINamespace } from '@grafana/api-clients';
import { t } from '@grafana/i18n';
import { config, getBackendSrv } from '@grafana/runtime';
import { collectionsAPIv1alpha1 } from 'app/api/clients/collections/v1alpha1';
import { dashboardAPIv0alpha1 } from 'app/api/clients/dashboard/v0alpha1';
import { legacyAPI } from 'app/api/clients/legacy';
import { contextSrv } from 'app/core/services/context_srv';
import { STARRED_FOLDERS_UID, TEAM_FOLDERS_UID, isRootFolderUID } from 'app/features/search/constants';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult, type NestedFolderDTO } from 'app/features/search/service/types';
import { extractManagerKind, queryResultToViewItem } from 'app/features/search/service/utils';
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
  starredFoldersEnabled,
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

// --- Phase 1.5 PoC: folder path visibility (identity-access-team#2285 §4.5) ---
//
// Items whose parent isn't accessible but whose full ancestor *name* chain resolves are placed
// in their real tree position, with the inaccessible ancestors rendered as inert "ghost" nodes,
// instead of falling through to Shared with me (excluded there by the backend when
// authz.folderPathVisibility is on -- see pkg/registry/apis/dashboard/search.go). This module
// never reads or writes anything under Shared with me; it only discovers candidates via the
// legacy /api/search?folder=sharedwithme (unaffected by that backend exclusion, since it's a
// separate implementation) purely as a signal for where to inject ghost ancestors at the root.
//
// Ghost ancestor UID -> its already-resolved real children, so that expanding a ghost node in
// the tree serves these instead of hitting listFolders/listDashboards's normal search path,
// which would come back empty (the caller has no access to the ghost itself).
const ghostChildrenByUID = new Map<string, DashboardViewItem[]>();
const ghostFolderUIDs = new Set<string>();

export function isGhostAncestorFolder(uid: string): boolean {
  return ghostFolderUIDs.has(uid);
}

function getGhostChildren(parentUID: string, kind: DashboardViewItem['kind']): DashboardViewItem[] {
  return (ghostChildrenByUID.get(parentUID) ?? []).filter((item) => item.kind === kind);
}

interface RawOrphan {
  uid: string;
  title: string;
  url?: string;
  kind: 'folder' | 'dashboard';
  // Immediate (real) parent UID, per the legacy search response -- the folder the item lives in
  // that the caller can't directly read.
  folderUid: string;
}

async function fetchRawOrphans(): Promise<RawOrphan[]> {
  const rows = await getBackendSrv().get<
    Array<{ uid: string; title: string; type: string; url?: string; folderUid?: string }>
  >('/api/search', { folder: 'sharedwithme' });

  return rows
    .filter((row): row is typeof row & { folderUid: string } => Boolean(row.folderUid))
    .map((row) => ({
      uid: row.uid,
      title: row.title,
      url: row.url,
      kind: row.type === 'dash-folder' ? ('folder' as const) : ('dashboard' as const),
      folderUid: row.folderUid,
    }));
}

interface FolderInfo {
  name: string;
  title: string;
  parent?: string;
  detached?: boolean;
}

async function getFolderParents(uid: string): Promise<FolderInfo[]> {
  const namespace = getAPINamespace();
  const resp = await getBackendSrv().get<{ items?: FolderInfo[] }>(
    `/apis/folder.grafana.app/v1beta1/namespaces/${namespace}/folders/${uid}/parents`
  );
  return resp.items ?? [];
}

// Resolves the ancestor chain for every distinct orphan, builds the ghost + real nodes along the
// way (deduped, since multiple orphans can share ancestors), and returns only the root-level ones
// -- deeper levels are served later via getGhostChildren() as the tree expands.
async function fetchGhostAncestorItems(): Promise<NestedFolderDTO[]> {
  ghostChildrenByUID.clear();
  ghostFolderUIDs.clear();

  const orphans = await fetchRawOrphans();
  if (orphans.length === 0) {
    return [];
  }

  const nodesByUID = new Map<string, DashboardViewItem>();

  // Folder-kind orphans are themselves directly accessible (that's exactly why they're orphans:
  // the folder itself is readable, its parent isn't) -- /parents on the orphan's OWN uid works,
  // and the endpoint does the privileged walk for anything inaccessible above it. Calling
  // /parents on orphan.folderUid instead (the inaccessible parent) would 403, since that
  // subresource still requires "get" on whatever uid is in the URL.
  for (const orphan of orphans) {
    if (orphan.kind !== 'folder' || nodesByUID.has(orphan.uid)) {
      continue;
    }

    let chain: FolderInfo[];
    try {
      chain = await getFolderParents(orphan.uid);
    } catch (error) {
      // Can't resolve this chain (e.g. a genuine cycle, or the privileged read itself failed) --
      // leave this orphan unplaced rather than guessing at a position for it.
      console.error(`Failed to resolve ghost ancestor chain for ${orphan.uid}`, error);
      continue;
    }

    let prevUID: string | undefined = undefined;
    for (const node of chain) {
      if (!nodesByUID.has(node.name)) {
        const isGhost = Boolean(node.detached);
        if (isGhost) {
          ghostFolderUIDs.add(node.name);
        }
        nodesByUID.set(node.name, {
          kind: 'folder',
          uid: node.name,
          title: node.title,
          parentUID: prevUID,
          url: isGhost ? undefined : getFolderURL(node.name),
        });
      }
      prevUID = node.name;
    }
  }

  // Dashboard-kind orphans have no /parents of their own (only folders do), and their immediate
  // parent is by definition inaccessible to the caller directly -- so they can only be placed if
  // a folder-kind sibling under that same parent already resolved it above.
  for (const orphan of orphans) {
    if (orphan.kind !== 'dashboard' || !nodesByUID.has(orphan.folderUid)) {
      continue;
    }
    nodesByUID.set(orphan.uid, {
      kind: 'dashboard',
      uid: orphan.uid,
      title: orphan.title,
      parentUID: orphan.folderUid,
      url: orphan.url,
    });
  }

  for (const node of nodesByUID.values()) {
    if (node.parentUID !== undefined) {
      const siblings = ghostChildrenByUID.get(node.parentUID) ?? [];
      siblings.push(node);
      ghostChildrenByUID.set(node.parentUID, siblings);
    }
  }

  return Array.from(nodesByUID.values())
    .filter((node) => node.parentUID === undefined)
    .map((node) => ({ uid: node.uid, title: node.title }));
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

  // Virtual root folders are only injected at the top level (first page, no parent).
  if (page === 1 && !parentUID) {
    // Add shared with me item statically to the array as it is not returned from the
    // API anymore. This also means we show it every time, whether it has children or not. This is the same as in folder
    // picker for now. In the future we could to additional request to see if there are any children in it.
    if (config.sharedWithMeFolderUID) {
      folders.unshift({
        ...virtualFolderBase,
        uid: config.sharedWithMeFolderUID,
        name: t('browse-dashboards.shared-with-me', 'Shared with me'),
      });
    }

    // Add team folders virtual item
    const insertIndex = config.sharedWithMeFolderUID ? 1 : 0;
    folders.splice(insertIndex, 0, {
      ...virtualFolderBase,
      name: t('browse-dashboards.my-team-folders', 'My team folders'),
      uid: TEAM_FOLDERS_UID,
    });

    // Add starred folders virtual item after the other virtual roots so root order is
    // [Shared with me, Team folders, Starred folders, ...real folders]
    if (starredFoldersEnabled()) {
      const insertIndex = (config.sharedWithMeFolderUID ? 1 : 0) + 1;
      folders.splice(insertIndex, 0, {
        ...virtualFolderBase,
        name: t('browse-dashboards.starred-folders', 'Starred folders'),
        uid: STARRED_FOLDERS_UID,
      });
    }
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
  // Ghost ancestors (Phase 1.5 PoC, see comment above fetchGhostAncestorItems) have no real
  // backing folder object the caller can query -- serve their already-resolved children instead
  // of hitting the search API, which would come back empty.
  if (parentUID !== undefined && isGhostAncestorFolder(parentUID)) {
    return getGhostChildren(parentUID, 'folder');
  }

  let folders: NestedFolderDTO[] = [];
  if (contextSrv.hasPermission(AccessControlAction.FoldersRead)) {
    if (config.featureToggles.foldersAppPlatformAPI) {
      folders = await searchNewAPI(parentUID, page, pageSize);
    } else {
      folders = await searchOldAPI(parentUID, page, pageSize);
    }
  }

  if (parentUID === undefined && page === 1 && config.featureToggles['authz.folderPathVisibility']) {
    folders = folders.concat(await listSafeGhosts(fetchGhostAncestorItems));
  }

  return folders.map(({ uid, title, managedBy }) => {
    const noUrl =
      isSharedWithMe(uid) || isVirtualTeamFolder(uid) || isVirtualStarredFolder(uid) || isGhostAncestorFolder(uid);
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

async function listSafeGhosts(load: () => Promise<NestedFolderDTO[]>): Promise<NestedFolderDTO[]> {
  try {
    return await load();
  } catch (error) {
    console.error('Failed to load ghost ancestor folders', error);
    return [];
  }
}

export async function listDashboards(parentUID?: string, page = 1, pageSize = PAGE_SIZE): Promise<DashboardViewItem[]> {
  if (parentUID !== undefined && isGhostAncestorFolder(parentUID)) {
    return getGhostChildren(parentUID, 'dashboard');
  }

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
