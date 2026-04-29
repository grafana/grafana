import { useEffect, useState } from 'react';

import { listFolders } from 'app/features/browse-dashboards/api/services';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult } from 'app/features/search/service/types';
import { queryResultToViewItem } from 'app/features/search/service/utils';

const PAGE_SIZE = 200;
const MAX_PAGES = 25;

export interface FolderDashboard {
  uid: string;
  title: string;
  managedBy?: string;
  url?: string;
}

export interface FolderRow {
  uid: string;
  title: string;
  parentTitle?: string;
  managedBy?: string;
  dashboardCount: number;
  unmanagedDashboardCount: number;
  managedDashboardCount: number;
  /** Distinct list of manager kinds active inside the folder, e.g. ['repo']. */
  managerKinds: string[];
  dashboards: FolderDashboard[];
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
  const byFolder = new Map<string, FolderRow>();
  for (const folder of folders) {
    byFolder.set(folder.uid, {
      uid: folder.uid,
      title: folder.title,
      managedBy: folder.managedBy,
      dashboardCount: 0,
      unmanagedDashboardCount: 0,
      managedDashboardCount: 0,
      managerKinds: [],
      dashboards: [],
    });
  }
  for (const dash of dashboards) {
    if (!dash.parentUid) {
      // Skip dashboards in the General folder for now — they're a special case
      // that doesn't map cleanly to a folder migration target.
      continue;
    }
    let entry = byFolder.get(dash.parentUid);
    if (!entry) {
      entry = {
        uid: dash.parentUid,
        title: dash.parentUid,
        dashboardCount: 0,
        unmanagedDashboardCount: 0,
        managedDashboardCount: 0,
        managerKinds: [],
        dashboards: [],
      };
      byFolder.set(dash.parentUid, entry);
    }
    entry.dashboardCount += 1;
    entry.dashboards.push({ uid: dash.uid, title: dash.title, managedBy: dash.managedBy, url: dash.url });
    if (dash.managedBy) {
      entry.managedDashboardCount += 1;
      if (!entry.managerKinds.includes(dash.managedBy)) {
        entry.managerKinds.push(dash.managedBy);
      }
    } else {
      entry.unmanagedDashboardCount += 1;
    }
  }
  // Sort folder rows by unmanaged-dashboard count desc (then total desc, then title asc)
  // so the highest-leverage migration targets surface first.
  return Array.from(byFolder.values())
    .filter((row) => row.dashboardCount > 0)
    .sort((a, b) => {
      if (b.unmanagedDashboardCount !== a.unmanagedDashboardCount) {
        return b.unmanagedDashboardCount - a.unmanagedDashboardCount;
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
