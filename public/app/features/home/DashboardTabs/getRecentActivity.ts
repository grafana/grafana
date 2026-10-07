import { pageHistorySrv } from 'app/core/services/pageHistory/pageHistorySrv';
import { type PageHistoryEntry, type PageHistoryKind } from 'app/core/services/pageHistory/types';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult } from 'app/features/search/service/types';

import { describeExploreState } from './describePageState';

type EntryOf<K extends PageHistoryKind> = Extract<PageHistoryEntry, { kind: K }>;

/**
 * A history entry plus what needs an async lookup to show it: the search hit that proved the user
 * can still see a dashboard (title, folder), or the described datasource and query of an Explore
 * page. Everything else is derived from the entry at render time.
 */
export type RecentActivityItem =
  | (EntryOf<'dashboard'> & { dashboard: DashboardQueryResult })
  | (EntryOf<'explore'> & { state: string })
  | EntryOf<'alerting' | 'app'>;

export interface RecentActivity {
  items: RecentActivityItem[];
  /** Pages per kind across the whole history, so the filter shows what each kind would reveal. */
  counts: Record<PageHistoryKind, number>;
}

/**
 * Newest first. The history is already capped per kind, so no display cap is needed. Dashboards
 * the user can no longer see are dropped. A failed dashboard search propagates: one error surface
 * for the tab.
 */
export async function getRecentActivity(filter?: PageHistoryKind): Promise<RecentActivity> {
  const history = await pageHistorySrv.getEntries();
  const counts: Record<PageHistoryKind, number> = { dashboard: 0, explore: 0, alerting: 0, app: 0 };
  for (const entry of history) {
    counts[entry.kind]++;
  }

  const entries = filter ? history.filter((entry) => entry.kind === filter) : history;
  // Not awaited here so the Explore lookups below run alongside the search.
  const dashboards = findDashboards(entries.flatMap((entry) => (entry.kind === 'dashboard' ? [entry.uid] : [])));
  const items = await Promise.all(
    entries.map(async (entry): Promise<RecentActivityItem | undefined> => {
      switch (entry.kind) {
        case 'dashboard': {
          const dashboard = (await dashboards).get(entry.uid);
          return dashboard && { ...entry, dashboard };
        }
        case 'explore':
          return { ...entry, state: await describeExploreState(new URL(entry.href, 'http://localhost').search) };
        default:
          return entry;
      }
    })
  );
  return { items: items.filter((item) => item !== undefined), counts };
}

async function findDashboards(uids: string[]): Promise<Map<string, DashboardQueryResult>> {
  if (uids.length === 0) {
    return new Map();
  }
  const result = await getGrafanaSearcher().search({ kind: ['dashboard'], uid: uids, limit: uids.length });
  return new Map(result.view.toArray().map((hit) => [hit.uid, hit]));
}
