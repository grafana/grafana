import { useEffect, useState } from 'react';

import { listFolders } from 'app/features/browse-dashboards/api/services';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult } from 'app/features/search/service/types';
import { queryResultToViewItem } from 'app/features/search/service/utils';

const PAGE_SIZE = 200;
const MAX_PAGES = 25;

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
  dashboardCount: number;
}

interface State {
  data: FolderRow[];
  isLoading: boolean;
  isError: boolean;
}

async function fetchAllFolders(): Promise<Array<{ uid: string; title: string; managedBy?: string }>> {
  const all: Array<{ uid: string; title: string; managedBy?: string }> = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await listFolders(undefined, undefined, page, PAGE_SIZE);
    for (const f of batch) {
      all.push({ uid: f.uid, title: f.title, managedBy: f.managedBy });
    }
    if (batch.length < PAGE_SIZE) {
      break;
    }
  }
  return all;
}

async function fetchAllDashboards(): Promise<
  Array<{ uid: string; title: string; parentUid?: string; managedBy?: string; url: string }>
> {
  const searcher = getGrafanaSearcher();
  const all: Array<{ uid: string; title: string; parentUid?: string; managedBy?: string; url: string }> = [];
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
      all.push({
        uid: view.uid,
        title: view.title,
        parentUid: view.parentUID,
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
  folders: Array<{ uid: string; title: string; managedBy?: string }>,
  dashboards: Array<{ uid: string; title: string; parentUid?: string; managedBy?: string; url: string }>
): FolderRow[] {
  // A folder is single-managed: its `managedBy` is the source of truth for
  // every dashboard inside. We only use the dashboard list to count how many
  // dashboards each folder holds.
  const dashboardCountByFolder = new Map<string, number>();
  for (const dash of dashboards) {
    if (!dash.parentUid) {
      // Dashboards in the General folder are a special case — they don't map
      // to a folder migration target.
      continue;
    }
    dashboardCountByFolder.set(dash.parentUid, (dashboardCountByFolder.get(dash.parentUid) ?? 0) + 1);
  }

  const rows: FolderRow[] = folders.map((folder) => ({
    uid: folder.uid,
    title: folder.title,
    managedBy: folder.managedBy,
    dashboardCount: dashboardCountByFolder.get(folder.uid) ?? 0,
  }));

  // Sort: unmanaged folders first (the migration targets), then by dashboard
  // count desc so the highest-leverage targets surface at the top, then title.
  return rows
    .filter((row) => row.dashboardCount > 0)
    .sort((a, b) => {
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
