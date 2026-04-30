import { useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { listFolders } from 'app/features/browse-dashboards/api/services';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult } from 'app/features/search/service/types';
import { queryResultToViewItem } from 'app/features/search/service/utils';

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
}

async function fetchAllFolders(): Promise<
  Array<{ uid: string; title: string; parentUid?: string; managedBy?: string }>
> {
  const all: Array<{ uid: string; title: string; parentUid?: string; managedBy?: string }> = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await listFolders(undefined, undefined, page, PAGE_SIZE);
    for (const f of batch) {
      all.push({ uid: f.uid, title: f.title, parentUid: f.parentUID, managedBy: f.managedBy });
    }
    if (batch.length < PAGE_SIZE) {
      break;
    }
  }
  return all;
}

async function fetchAllDashboards(): Promise<
  Array<{ uid: string; title: string; ancestors: string[]; managedBy?: string; url: string }>
> {
  const searcher = getGrafanaSearcher();
  const all: Array<{ uid: string; title: string; ancestors: string[]; managedBy?: string; url: string }> = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await searcher.search({
      kind: ['dashboard'],
      query: '*',
      from: (page - 1) * PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    });
    const rows: DashboardQueryResult[] = result.view.toArray();
    for (const item of rows) {
      const view = queryResultToViewItem(item, result.view);
      // `item.location` is the full ancestor path, e.g. "rootUid/subUid". The
      // searcher returns the literal `general` UID for dashboards that sit at
      // the root, so we strip that out — the synthetic General row in
      // aggregate() picks them up via an empty ancestor path.
      const path = typeof item.location === 'string' ? item.location : '';
      const ancestors = path.split('/').filter((segment) => segment && segment !== GENERAL_FOLDER_UID);
      all.push({
        uid: view.uid,
        title: view.title,
        ancestors,
        managedBy: view.managedBy,
        url: view.url ?? '',
      });
    }
    if (rows.length < PAGE_SIZE) {
      break;
    }
  }
  return all;
}

function aggregate(
  folders: Array<{ uid: string; title: string; parentUid?: string; managedBy?: string }>,
  dashboards: Array<{ uid: string; title: string; ancestors: string[]; managedBy?: string; url: string }>
): FolderRow[] {
  // Migration is recursive: picking a folder migrates that folder plus every
  // descendant folder and dashboard. The dashboard count for a folder is the
  // number of dashboards anywhere in its subtree, so we walk every dashboard's
  // ancestor path and increment the counter for each ancestor.
  //
  // Dashboards that sit directly under the General root (empty ancestor path)
  // are still migration targets — they roll up into a synthetic "General"
  // row that picks them all up in one shot.
  const dashboardCountByFolder = new Map<string, number>();
  const directDashboardsByFolder = new Map<string, FolderPeekDashboard[]>();
  const allDashboardsByFolder = new Map<string, FolderPeekDashboard[]>();
  const rootDirectDashboards: FolderPeekDashboard[] = [];
  let rootDashboardCount = 0;

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
    if (dash.ancestors.length === 0) {
      rootDashboardCount += 1;
      rootDirectDashboards.push(dashItem);
      continue;
    }
    for (const ancestorUid of dash.ancestors) {
      dashboardCountByFolder.set(ancestorUid, (dashboardCountByFolder.get(ancestorUid) ?? 0) + 1);
      pushTo(allDashboardsByFolder, ancestorUid, dashItem);
    }
    pushTo(directDashboardsByFolder, dash.ancestors[dash.ancestors.length - 1], dashItem);
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

  if (rootDashboardCount > 0 || (subfoldersByParent.get(GENERAL_FOLDER_UID)?.length ?? 0) > 0) {
    rows.push({
      uid: GENERAL_FOLDER_UID,
      title: t('provisioning.stats.general-folder-title', 'General (root dashboards)'),
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
  const [state, setState] = useState<State>({ data: [], isLoading: true, isError: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [folders, dashboards] = await Promise.all([fetchAllFolders(), fetchAllDashboards()]);
        if (cancelled) {
          return;
        }
        setState({ data: aggregate(folders, dashboards), isLoading: false, isError: false });
      } catch (err) {
        if (!cancelled) {
          setState({ data: [], isLoading: false, isError: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
