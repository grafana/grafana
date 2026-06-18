import { useCallback, useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult } from 'app/features/search/service/types';
import { extractManagerKind, queryResultToViewItem } from 'app/features/search/service/utils';

const PAGE_SIZE = 200;
// Safety guardrail so a pathological response (or an enormous instance) can't
// spin off unbounded requests. Generous on purpose — well past any realistic
// folder/dashboard count — so it never truncates normal instances; the proper
// fix is the backend roll-up the hook's JSDoc points at.
const MAX_PAGES = 200;

interface FolderPeekDashboard {
  uid: string;
  title: string;
  url: string;
}

export interface FolderRow {
  uid: string;
  title: string;
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

/**
 * Pages through every item of a kind via the unified searcher. The first page
 * also reports `totalRows`, so the remaining pages are fetched concurrently
 * rather than one sequential round-trip at a time. Bounded by MAX_PAGES.
 */
async function fetchAllPages(kind: 'folder' | 'dashboard'): Promise<DashboardQueryResult[]> {
  const searcher = getGrafanaSearcher();
  const searchPage = (page: number) =>
    searcher.search({
      kind: [kind],
      query: '*',
      from: page * PAGE_SIZE,
      offset: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    });

  const first = await searchPage(0);
  const firstItems: DashboardQueryResult[] = first.view.toArray();
  const total = typeof first.totalRows === 'number' ? first.totalRows : firstItems.length;
  const pageCount = Math.min(Math.max(1, Math.ceil(total / PAGE_SIZE)), MAX_PAGES);

  if (pageCount <= 1) {
    return firstItems;
  }

  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) => searchPage(index + 1).then((result) => result.view.toArray()))
  );
  return firstItems.concat(...rest);
}

// `kind: ['folder']` with no location filter returns every folder on the
// instance — root-level *and* nested. listFolders only returns immediate
// children of a single parent, which would silently drop subfolders.
async function fetchAllFolders(): Promise<
  Array<{ uid: string; title: string; parentUid?: string; managedBy?: string }>
> {
  const items = await fetchAllPages('folder');
  return items.map((item) => ({
    uid: item.uid,
    title: item.name,
    parentUid: readImmediateParent(item.location),
    managedBy: extractManagerKind(item.managedBy),
  }));
}

async function fetchAllDashboards(): Promise<
  Array<{ uid: string; title: string; parentUid?: string; managedBy?: string; url: string }>
> {
  const items = await fetchAllPages('dashboard');
  return items.map((item) => {
    const view = queryResultToViewItem(item);
    return {
      uid: view.uid,
      title: view.title,
      parentUid: readImmediateParent(item.location),
      managedBy: view.managedBy,
      url: view.url ?? '',
    };
  });
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
  // dashboards (i.e. unmanaged) — they feed the ResourcesToMigrate UI which is
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
    // Already-managed dashboards aren't migration targets — the migrate
    // backend only takes unmanaged dashboards, and the UI counts shouldn't
    // surface them as work to do. Skip them for everything that feeds the
    // migration flow (subtree counts, expand view, migrate payload).
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

  const rows: FolderRow[] = folders.map((folder) => ({
    uid: folder.uid,
    title: folder.title,
    managedBy: folder.managedBy,
    dashboardCount: dashboardCountByFolder.get(folder.uid) ?? 0,
    directDashboards: directDashboardsByFolder.get(folder.uid) ?? [],
    allDashboards: allDashboardsByFolder.get(folder.uid) ?? [],
  }));

  // Only synthesize the General row when there are dashboards sitting directly
  // at the root. Root-level *folders* are their own rows; an empty "General"
  // row (no root dashboards) would otherwise show up as a bogus migration
  // target now that empty folders are migratable.
  if (rootTotalDashboards > 0) {
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
      title: t('provisioning.migrate.general-folder-title', 'General (root resources)'),
      managedBy: generalManagedBy,
      dashboardCount: rootDashboardCount,
      directDashboards: rootDirectDashboards,
      allDashboards: rootDirectDashboards,
    });
  }

  // Default ordering: unmanaged folders first, then by dashboard count desc so
  // the folders with the most to migrate surface at the top, then title. The
  // table lets the user re-sort; this is just a sensible initial order. This
  // hook returns every folder (empty ones included); the UI decides what's a
  // migration target via isMigratableFolder.
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
 * APIs and joins them into a per-folder roll-up of dashboard counts and
 * management state. It pages through every folder and dashboard on the
 * instance. When a dedicated backend endpoint for this roll-up lands, swap the
 * body of this hook to consume it.
 */
export function useFolderMigrationData(): State & { refetch: () => void } {
  const [state, setState] = useState<State>({
    data: [],
    isLoading: true,
    isError: false,
  });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [folders, dashboards] = await Promise.all([fetchAllFolders(), fetchAllDashboards()]);
        if (cancelled) {
          return;
        }
        setState({
          data: aggregate(folders, dashboards),
          isLoading: false,
          isError: false,
        });
      } catch (err) {
        if (!cancelled) {
          setState({ data: [], isLoading: false, isError: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  // Refetch in the background — we don't flip back to the loading state, so a
  // post-migration refresh doesn't unmount the page (and the drawer that
  // triggered it); the rows just update once the new data lands.
  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  return { ...state, refetch };
}
