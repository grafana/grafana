import { useCallback, useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult } from 'app/features/search/service/types';
import { queryResultToViewItem } from 'app/features/search/service/utils';

const PAGE_SIZE = 200;
// How many page requests of one kind to have in flight at once. Keeps the
// fan-out bounded (folders and dashboards each batch independently) so a large
// instance doesn't fire hundreds of concurrent requests on load.
const PAGE_CONCURRENCY = 5;
// Safety guardrail so a pathological response (or an enormous instance) can't
// spin off unbounded requests. Generous on purpose — well past any realistic
// folder/dashboard count. Exceeding it throws (rather than returning a
// truncated list) so the page fails loudly; the proper fix is a backend
// roll-up the hook's JSDoc points at.
const MAX_PAGES = 200;

interface FolderDashboard {
  uid: string;
  title: string;
}

export interface FolderRow {
  uid: string;
  title: string;
  /** Number of unmanaged dashboards directly in this folder. */
  dashboardCount: number;
  /**
   * The unmanaged dashboards directly in this folder. Selective migration is
   * not recursive — dashboards in subfolders are migrated through their own
   * folder's row, not this one.
   */
  directDashboards: FolderDashboard[];
}

interface State {
  data: FolderRow[];
  isLoading: boolean;
  isError: boolean;
}

/**
 * The unified searcher reports a dashboard's *immediate* parent folder UID in
 * `item.location`. Root-level dashboards come back with an empty UID or the
 * literal "general" UID; normalize both to undefined.
 */
function readImmediateParent(location: string): string | undefined {
  const trimmed = location.trim();
  if (!trimmed || trimmed === GENERAL_FOLDER_UID) {
    return undefined;
  }
  return trimmed;
}

/**
 * Pages through every item of a kind via the unified searcher. The first page
 * reports `totalRows`, so the remaining pages are fetched in small concurrent
 * batches (PAGE_CONCURRENCY) rather than one sequential round-trip at a time or
 * one big burst. Bounded by MAX_PAGES.
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
  const items: DashboardQueryResult[] = first.view.toArray();
  const totalRows = first.totalRows;
  const pageCount = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  // Fail loudly rather than silently truncating: a partial list would drop rows
  // from the table and, worse, from the selective-migration payload.
  if (pageCount > MAX_PAGES) {
    throw new Error(`Too many ${kind}s to enumerate (${totalRows}); aborting to avoid an incomplete migration list.`);
  }

  for (let page = 1; page < pageCount; page += PAGE_CONCURRENCY) {
    const batch = Array.from({ length: Math.min(PAGE_CONCURRENCY, pageCount - page) }, (_, index) =>
      searchPage(page + index)
    );
    for (const result of await Promise.all(batch)) {
      items.push(...result.view.toArray());
    }
  }
  return items;
}

// `kind: ['folder']` returns every folder on the instance; we only need each
// folder's UID and title to label the rows.
async function fetchAllFolders(): Promise<Array<{ uid: string; title: string }>> {
  const items = await fetchAllPages('folder');
  return items.map((item) => ({ uid: item.uid, title: item.name }));
}

async function fetchAllDashboards(): Promise<
  Array<{ uid: string; title: string; parentUid?: string; managedBy?: string }>
> {
  const items = await fetchAllPages('dashboard');
  return items.map((item) => {
    const view = queryResultToViewItem(item);
    return {
      uid: view.uid,
      title: view.title,
      parentUid: readImmediateParent(item.location),
      managedBy: view.managedBy,
    };
  });
}

/**
 * Groups unmanaged dashboards under the folder that directly contains them and
 * emits one row per folder that has at least one. Migration is dashboard-centric
 * and non-recursive: a folder's row covers only the dashboards directly inside
 * it (subfolders get their own rows), and folders with nothing to migrate —
 * empty, already-managed, or holding only subfolders — are left out entirely.
 * Dashboards at the root roll up into a synthetic "General" row.
 */
function aggregate(
  folders: Array<{ uid: string; title: string }>,
  dashboards: Array<{ uid: string; title: string; parentUid?: string; managedBy?: string }>
): FolderRow[] {
  const folderTitle = new Map(folders.map((folder) => [folder.uid, folder.title]));
  const directByFolder = new Map<string, FolderDashboard[]>();
  const rootDashboards: FolderDashboard[] = [];

  for (const dash of dashboards) {
    // Already-managed dashboards aren't migration targets — the migrate backend
    // only takes unmanaged dashboards.
    if (dash.managedBy) {
      continue;
    }
    const item: FolderDashboard = { uid: dash.uid, title: dash.title };
    if (!dash.parentUid) {
      rootDashboards.push(item);
      continue;
    }
    const existing = directByFolder.get(dash.parentUid);
    if (existing) {
      existing.push(item);
    } else {
      directByFolder.set(dash.parentUid, [item]);
    }
  }

  const rows: FolderRow[] = [];
  for (const [uid, directDashboards] of directByFolder) {
    rows.push({
      uid,
      title: folderTitle.get(uid) ?? uid,
      dashboardCount: directDashboards.length,
      directDashboards,
    });
  }
  if (rootDashboards.length > 0) {
    rows.push({
      uid: GENERAL_FOLDER_UID,
      title: t('provisioning.migrate.general-folder-title', 'General (root resources)'),
      dashboardCount: rootDashboards.length,
      directDashboards: rootDashboards,
    });
  }

  // Default ordering: most dashboards first so the folders with the most to
  // migrate surface at the top, then by title. The table lets the user re-sort.
  return rows.sort((a, b) => {
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
 * APIs and joins them into a per-folder list of the unmanaged dashboards each
 * folder directly contains. It pages through every folder and dashboard on the
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
