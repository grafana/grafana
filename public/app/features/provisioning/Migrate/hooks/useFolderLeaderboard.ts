import { useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult } from 'app/features/search/service/types';
import { extractManagerKind, queryResultToViewItem } from 'app/features/search/service/utils';

const PAGE_SIZE = 200;
const MAX_PAGES = 25;

export interface FolderPeekDashboard {
  uid: string;
  title: string;
  url: string;
}

export interface FolderPeekSubfolder {
  uid: string;
  title: string;
  dashboardCount: number;
}

export interface FolderRow {
  uid: string;
  title: string;
  parentTitle?: string;
  /**
   * The provisioning tool that manages this folder, if any. A folder is
   * single-managed: when this is set, every dashboard inside the folder is
   * managed by the same tool; when it's unset, every dashboard is unmanaged.
   */
  managedBy?: string;
  /** Recursive count: dashboards anywhere inside this folder's subtree. */
  dashboardCount: number;
  /** Dashboards directly in this folder (not nested), used by the expand view. */
  directDashboards: FolderPeekDashboard[];
  /** Folders directly under this folder. */
  subfolders: FolderPeekSubfolder[];
  /**
   * Every dashboard anywhere in this folder's subtree. Used by the migrate
   * call (which only accepts dashboard refs, not folder refs) and by the
   * cascading folder-selection logic in the UI.
   */
  allDashboards: FolderPeekDashboard[];
}

interface State {
  data: FolderRow[];
  isLoading: boolean;
  isError: boolean;
  /**
   * True when either the folder or dashboard fetch hit MAX_PAGES * PAGE_SIZE
   * and stopped paging. The leaderboard then represents only a subset of the
   * instance — surface this so the page can warn the admin.
   */
  isTruncated: boolean;
}

interface PagedResult<T> {
  rows: T[];
  truncated: boolean;
}

/**
 * The unified searcher exposes only the *immediate* parent folder UID in
 * `item.location` (`DashboardHit.folder`), not the full ancestor chain.
 * Treat it as that — the recursive ancestor walk happens in aggregate(),
 * using the folder→parent map we build from the folder fetch.
 */
function readImmediateParent(location: unknown): string | undefined {
  if (typeof location !== 'string') {
    return undefined;
  }
  const trimmed = location.trim();
  if (!trimmed || trimmed === GENERAL_FOLDER_UID) {
    return undefined;
  }
  return trimmed;
}

async function fetchAllFolders(): Promise<
  PagedResult<{ uid: string; title: string; parentUid?: string; managedBy?: string }>
> {
  const searcher = getGrafanaSearcher();
  const rows: Array<{ uid: string; title: string; parentUid?: string; managedBy?: string }> = [];
  // Use the searcher with `kind: ['folder']` and no location filter so we get
  // every folder on the instance — root-level *and* nested. listFolders only
  // returns immediate children of a single parent, which would silently drop
  // subfolders from the leaderboard.
  let totalRows = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await searcher.search({
      kind: ['folder'],
      query: '*',
      from: (page - 1) * PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    });
    const items: DashboardQueryResult[] = result.view.toArray();
    // The searcher reports the total matching count on every response; cache
    // it so we can compare what we *collected* against what *exists* once the
    // loop ends. Comparing rows.length to totalRows is the only honest check
    // for truncation — using "page 25 was full" produces a false positive
    // when the dataset size is exactly MAX_PAGES * PAGE_SIZE.
    if (typeof result.totalRows === 'number') {
      totalRows = result.totalRows;
    }
    for (const item of items) {
      rows.push({
        uid: item.uid,
        title: item.name,
        parentUid: readImmediateParent(item.location),
        managedBy: extractManagerKind(item.managedBy),
      });
    }
    if (items.length < PAGE_SIZE) {
      break;
    }
  }
  return { rows, truncated: totalRows > rows.length };
}

async function fetchAllDashboards(): Promise<
  PagedResult<{ uid: string; title: string; parentUid?: string; managedBy?: string; url: string }>
> {
  const searcher = getGrafanaSearcher();
  const rows: Array<{ uid: string; title: string; parentUid?: string; managedBy?: string; url: string }> = [];
  let totalRows = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await searcher.search({
      kind: ['dashboard'],
      query: '*',
      from: (page - 1) * PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    });
    const items: DashboardQueryResult[] = result.view.toArray();
    if (typeof result.totalRows === 'number') {
      totalRows = result.totalRows;
    }
    for (const item of items) {
      const view = queryResultToViewItem(item, result.view);
      rows.push({
        uid: view.uid,
        title: view.title,
        parentUid: readImmediateParent(item.location),
        managedBy: view.managedBy,
        url: view.url ?? '',
      });
    }
    if (items.length < PAGE_SIZE) {
      break;
    }
  }
  return { rows, truncated: totalRows > rows.length };
}

function aggregate(
  folders: Array<{ uid: string; title: string; parentUid?: string; managedBy?: string }>,
  dashboards: Array<{ uid: string; title: string; parentUid?: string; managedBy?: string; url: string }>
): FolderRow[] {
  // Migration is recursive: picking a folder migrates that folder plus every
  // descendant folder and dashboard. The unified searcher only reports a
  // dashboard's *immediate* parent, so we have to walk the folder→parent map
  // ourselves to count dashboards against every ancestor. Dashboards directly
  // under the General root (no parent) roll up into a synthetic "General" row.
  const folderParent = new Map<string, string | undefined>();
  for (const folder of folders) {
    folderParent.set(folder.uid, folder.parentUid);
  }
  // Walks from the immediate parent up to the root, returning [parent, …, root].
  // Cycle-safe: stops if a UID is revisited (shouldn't happen in well-formed
  // data, but the API can occasionally return broken payloads).
  const ancestorsOf = (start: string | undefined): string[] => {
    const chain: string[] = [];
    const seen = new Set<string>();
    let cursor = start;
    while (cursor && !seen.has(cursor)) {
      chain.push(cursor);
      seen.add(cursor);
      cursor = folderParent.get(cursor);
    }
    return chain;
  };

  const dashboardCountByFolder = new Map<string, number>();
  const directDashboardsByFolder = new Map<string, FolderPeekDashboard[]>();
  const allDashboardsByFolder = new Map<string, FolderPeekDashboard[]>();
  const rootDirectDashboards: FolderPeekDashboard[] = [];
  // rootDashboardCount and rootDirectDashboards only track *migratable* root
  // dashboards (i.e. unmanaged) — they feed the FoldersToMigrate UI which is
  // scoped to migration targets. rootTotalDashboards tracks every root
  // dashboard so the General row still appears (with the right managedBy)
  // when every root dashboard is already provisioned.
  let rootDashboardCount = 0;
  let rootTotalDashboards = 0;
  const rootManagerKinds = new Set<string>();
  let rootHasUnmanaged = false;

  const pushTo = (map: Map<string, FolderPeekDashboard[]>, folderUid: string, dash: FolderPeekDashboard) => {
    const existing = map.get(folderUid);
    if (existing) {
      existing.push(dash);
    } else {
      map.set(folderUid, [dash]);
    }
  };

  for (const dash of dashboards) {
    const dashItem: FolderPeekDashboard = { uid: dash.uid, title: dash.title, url: dash.url };
    const ancestors = ancestorsOf(dash.parentUid);
    // Track whether each root has any unmanaged dashboard / which manager
    // kinds appear there, regardless of whether the dashboard itself is
    // migratable. This lets the synthetic General row report a single
    // managedBy when every root dashboard agrees, without skipping past
    // managed dashboards.
    if (ancestors.length === 0) {
      rootTotalDashboards += 1;
      if (dash.managedBy) {
        rootManagerKinds.add(dash.managedBy);
      } else {
        rootHasUnmanaged = true;
      }
    }
    // Already-managed dashboards aren't migration targets — the push/migrate
    // backend rejects them when they're sent in a job, and the UI counts
    // shouldn't surface them as work to do. Skip them for everything that
    // feeds the migration flow (subtree counts, expand view, push payload).
    if (dash.managedBy) {
      continue;
    }
    if (ancestors.length === 0) {
      rootDashboardCount += 1;
      rootDirectDashboards.push(dashItem);
      continue;
    }
    for (const ancestorUid of ancestors) {
      dashboardCountByFolder.set(ancestorUid, (dashboardCountByFolder.get(ancestorUid) ?? 0) + 1);
      pushTo(allDashboardsByFolder, ancestorUid, dashItem);
    }
    pushTo(directDashboardsByFolder, ancestors[0], dashItem);
  }

  // Group folders by parent so each row knows its direct subfolders.
  const subfoldersByParent = new Map<string, FolderPeekSubfolder[]>();
  for (const folder of folders) {
    const parent = folder.parentUid && folder.parentUid !== GENERAL_FOLDER_UID ? folder.parentUid : GENERAL_FOLDER_UID;
    const sub: FolderPeekSubfolder = {
      uid: folder.uid,
      title: folder.title,
      dashboardCount: dashboardCountByFolder.get(folder.uid) ?? 0,
    };
    const existing = subfoldersByParent.get(parent);
    if (existing) {
      existing.push(sub);
    } else {
      subfoldersByParent.set(parent, [sub]);
    }
  }

  const rows: FolderRow[] = folders.map((folder) => ({
    uid: folder.uid,
    title: folder.title,
    managedBy: folder.managedBy,
    dashboardCount: dashboardCountByFolder.get(folder.uid) ?? 0,
    directDashboards: directDashboardsByFolder.get(folder.uid) ?? [],
    subfolders: subfoldersByParent.get(folder.uid) ?? [],
    allDashboards: allDashboardsByFolder.get(folder.uid) ?? [],
  }));

  if (rootTotalDashboards > 0 || (subfoldersByParent.get(GENERAL_FOLDER_UID)?.length ?? 0) > 0) {
    // The General "folder" doesn't have its own managedBy on the backend.
    // Mirror the single-managed assumption from real folders: only treat the
    // General row as managed when every root dashboard agrees on the *same*
    // manager kind. A mix of repo-managed + terraform-managed dashboards, or
    // any unmanaged dashboard, falls through to undefined so the row still
    // appears as a migration target.
    const generalManagedBy =
      !rootHasUnmanaged && rootTotalDashboards > 0 && rootManagerKinds.size === 1
        ? rootManagerKinds.values().next().value
        : undefined;
    rows.push({
      uid: GENERAL_FOLDER_UID,
      title: t('provisioning.stats.general-folder-title', 'General (root dashboards)'),
      managedBy: generalManagedBy,
      dashboardCount: rootDashboardCount,
      directDashboards: rootDirectDashboards,
      subfolders: subfoldersByParent.get(GENERAL_FOLDER_UID) ?? [],
      allDashboards: rootDirectDashboards,
    });
  }

  // Sort: unmanaged folders first (the migration targets), then by dashboard
  // count desc so the highest-leverage targets surface at the top, then title.
  // Empty folders are kept — they're still valid migration targets even though
  // they have lower leverage.
  return rows.sort((a, b) => {
    const aIsUnmanaged = a.managedBy ? 0 : 1;
    const bIsUnmanaged = b.managedBy ? 0 : 1;
    if (aIsUnmanaged !== bIsUnmanaged) {
      return bIsUnmanaged - aIsUnmanaged;
    }
    if (b.dashboardCount !== a.dashboardCount) {
      return b.dashboardCount - a.dashboardCount;
    }
    // Folder lists are O(folders) — small enough to use localeCompare directly.
    // eslint-disable-next-line @grafana/no-locale-compare
    return a.title.localeCompare(b.title);
  });
}

/**
 * Frontend aggregation that fans out to the existing folder + dashboard search
 * APIs and joins them into a per-folder roll-up. Capped at MAX_PAGES * PAGE_SIZE
 * items each — fine for instances with up to a few thousand dashboards. When
 * the dedicated backend leaderboard endpoint lands, swap the body of this hook
 * to consume it.
 */
export function useFolderLeaderboard(): State {
  const [state, setState] = useState<State>({
    data: [],
    isLoading: true,
    isError: false,
    isTruncated: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [folders, dashboards] = await Promise.all([fetchAllFolders(), fetchAllDashboards()]);
        if (cancelled) {
          return;
        }
        setState({
          data: aggregate(folders.rows, dashboards.rows),
          isLoading: false,
          isError: false,
          isTruncated: folders.truncated || dashboards.truncated,
        });
      } catch (err) {
        if (!cancelled) {
          setState({ data: [], isLoading: false, isError: true, isTruncated: false });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
