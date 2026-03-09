import { t } from '@grafana/i18n';
import { config, getBackendSrv } from '@grafana/runtime';
import { dashboardAPIv0alpha1 } from 'app/api/clients/dashboard/v0alpha1';
import { legacyAPI } from 'app/api/clients/legacy';
import { TEAM_FOLDERS_UID } from 'app/core/components/NestedFolderPicker/useTeamOwnedFolder';
import { contextSrv } from 'app/core/services/context_srv';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { DashboardQueryResult, NestedFolderDTO } from 'app/features/search/service/types';
import { extractManagerKind, queryResultToViewItem } from 'app/features/search/service/utils';
import { DashboardViewItem } from 'app/features/search/types';
import { AccessControlAction } from 'app/types/accessControl';
import { ThunkDispatch } from 'app/types/store';

import { TEAM_FOLDER_PREFIX, getFolderURL, isSharedWithMe, isTeamFolderItem, isTeamFolders } from '../utils/dashboards';

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

  // Add team folders virtual item after shared with me (or at the start if shared with me is not present)
  if (!parentUID && config.featureToggles.teamFolders) {
    const insertIndex = config.sharedWithMeFolderUID ? 1 : 0;
    folders.splice(insertIndex, 0, {
      kind: 'folder',
      name: t('browse-dashboards.team-folders', 'Team folders'),
      uid: TEAM_FOLDERS_UID,
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
    url: isSharedWithMe(item.uid) || isTeamFolders(item.uid) || isTeamFolderItem(item.uid)
      ? undefined
      : getFolderURL(item.uid),
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

function teamFolderUID(teamUID: string) {
  return `${TEAM_FOLDER_PREFIX}${teamUID}`;
}

function parseTeamUID(uid: string): string {
  return uid.slice(TEAM_FOLDER_PREFIX.length);
}

// Stores team avatar URLs keyed by virtual folder UID (e.g. "teamfolder-team-{uid}")
const teamAvatarsByUID = new Map<string, string>();

export function getTeamAvatarUrl(uid: string): string | undefined {
  return teamAvatarsByUID.get(uid);
}

/**
 * Fetches the user's teams and returns a virtual folder item per team that owns at least one folder.
 */
export async function listTeamFolders(dispatch: ThunkDispatch): Promise<DashboardViewItem[]> {
  const teams = await dispatch(legacyAPI.endpoints.getSignedInUserTeamList.initiate(undefined)).unwrap();

  if (!teams || teams.length === 0) {
    return [];
  }

  const ownerReference = teams.map((team) => `iam.grafana.app/Team/${team.uid}`);

  const result = await dispatch(
    dashboardAPIv0alpha1.endpoints.searchDashboardsAndFolders.initiate({ ownerReference, type: 'folder' })
  ).unwrap();

  // Build a set of team UIDs that actually own folders
  const teamsWithFolders = new Set<string>();
  for (const hit of result.hits ?? []) {
    for (const ref of hit.ownerReferences ?? []) {
      // ref format: iam.grafana.app/Team/{teamUID}
      const parts = ref.split('/');
      if (parts.length === 3 && parts[1] === 'Team') {
        teamsWithFolders.add(parts[2]);
      }
    }
  }

  // Return one virtual folder per team that has folders
  return teams
    .filter((team) => teamsWithFolders.has(team.uid!))
    .map((team) => {
      const uid = teamFolderUID(team.uid!);
      if (team.avatarUrl) {
        teamAvatarsByUID.set(uid, team.avatarUrl);
      }
      return {
        kind: 'folder' as const,
        uid,
        title: team.name!,
        parentUID: TEAM_FOLDERS_UID,
      };
    });
}

/**
 * Fetches folders owned by a specific team.
 * @param teamFolderItemUID The virtual folder UID (e.g. `teamfolder-team-{teamUID}`)
 */
export async function listTeamFolderChildren(
  dispatch: ThunkDispatch,
  teamFolderItemUID: string
): Promise<DashboardViewItem[]> {
  const teamUID = parseTeamUID(teamFolderItemUID);
  const ownerReference = [`iam.grafana.app/Team/${teamUID}`];

  const result = await dispatch(
    dashboardAPIv0alpha1.endpoints.searchDashboardsAndFolders.initiate({ ownerReference, type: 'folder' })
  ).unwrap();

  return (result.hits ?? []).map((hit) => ({
    kind: 'folder' as const,
    uid: hit.name,
    title: hit.title,
    parentUID: teamFolderItemUID,
    url: getFolderURL(hit.name),
  }));
}
