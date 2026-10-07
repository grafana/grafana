import { pageHistorySrv } from 'app/core/services/pageHistory/pageHistorySrv';
import {
  PAGE_HISTORY_MAX_PER_KIND,
  type PageHistoryEntry,
  type PageHistoryKind,
} from 'app/core/services/pageHistory/types';
import { getRecentlyViewedDashboards } from 'app/features/browse-dashboards/api/recentlyViewed';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult } from 'app/features/search/service/types';

import { describeExploreState } from './describePageState';

type EntryOf<K extends PageHistoryKind> = Extract<PageHistoryEntry, { kind: K }>;

/**
 * A history entry plus what needs an async lookup to show it: the search hit that proved the user
 * can still see a dashboard (title, folder), or the described datasource and query of an Explore
 * page. Everything else is derived from the entry at render time. Dashboards backfilled from the
 * recently-viewed list predate page history and carry no visit time.
 */
export type RecentActivityItem =
  | (Omit<EntryOf<'dashboard'>, 'lastVisited'> & { dashboard: DashboardQueryResult; lastVisited?: number })
  | (EntryOf<'explore'> & { state: string })
  | EntryOf<'alerting' | 'app'>;

/** Rows that made the cut; Explore rows still need their state described. */
type VisibleEntry = Exclude<RecentActivityItem, { kind: 'explore' }> | EntryOf<'explore'>;

export type ActivityFilter = 'dashboards' | 'explore' | 'alerting' | 'apps';

export const ACTIVITY_FILTERS: ActivityFilter[] = ['dashboards', 'explore', 'alerting', 'apps'];

const FILTER_KINDS: Record<ActivityFilter, PageHistoryKind[]> = {
  dashboards: ['dashboard'],
  explore: ['explore'],
  alerting: ['alerting'],
  apps: ['app'],
};

export function isActivityFilter(value: string): value is ActivityFilter {
  return ACTIVITY_FILTERS.some((filter) => filter === value);
}

export interface RecentActivity {
  items: RecentActivityItem[];
  /** Pages per filter across the whole history, so the chips show what each filter would reveal. */
  counts: Record<ActivityFilter, number>;
}

/**
 * Newest first. The history is already capped per kind, so no display cap is needed. Dashboards
 * the user can no longer see are dropped. A failed dashboard search propagates: one error surface
 * for the tab.
 */
export async function getRecentActivity(filter?: ActivityFilter): Promise<RecentActivity> {
  const history = await pageHistorySrv.getEntries();
  const counts: Record<ActivityFilter, number> = { dashboards: 0, explore: 0, alerting: 0, apps: 0 };
  for (const id of ACTIVITY_FILTERS) {
    counts[id] = history.filter((entry) => FILTER_KINDS[id].includes(entry.kind)).length;
  }
  const entries = filter ? history.filter((entry) => FILTER_KINDS[filter].includes(entry.kind)) : history;

  const [dashboards, backfill] = await Promise.all([
    findDashboards(entries.flatMap((entry) => (entry.kind === 'dashboard' ? [entry.uid] : []))),
    backfillDashboards(history),
  ]);
  counts.dashboards += backfill.length;

  const visible = entries.flatMap((entry): VisibleEntry[] => {
    if (entry.kind !== 'dashboard') {
      return [entry];
    }
    const dashboard = dashboards.get(entry.uid);
    return dashboard ? [{ ...entry, dashboard }] : [];
  });

  const items = await Promise.all(
    visible.map(async (entry): Promise<RecentActivityItem> => {
      if (entry.kind !== 'explore') {
        return entry;
      }
      const { search } = new URL(entry.href, 'http://localhost');
      return { ...entry, state: await describeExploreState(search) };
    })
  );
  const showBackfill = !filter || filter === 'dashboards';
  return { items: showBackfill ? [...items, ...backfill] : items, counts };
}

async function findDashboards(uids: string[]): Promise<Map<string, DashboardQueryResult>> {
  if (uids.length === 0) {
    return new Map();
  }
  const result = await getGrafanaSearcher().search({ kind: ['dashboard'], uid: uids, limit: uids.length });
  return new Map(result.view.toArray().map((hit) => [hit.uid, hit]));
}

/**
 * Page history starts empty for everyone, but the recently-viewed list (impressions) goes back
 * years. Dashboards from it top the Dashboards kind up to its quota so the tab is useful from the
 * first visit; they drop out as real visits take their slots.
 */
async function backfillDashboards(history: PageHistoryEntry[]): Promise<RecentActivityItem[]> {
  const known = new Set(history.flatMap((entry) => (entry.kind === 'dashboard' ? [entry.uid] : [])));
  const missing = PAGE_HISTORY_MAX_PER_KIND - known.size;
  if (missing <= 0) {
    return [];
  }
  const recent = await getRecentlyViewedDashboards(PAGE_HISTORY_MAX_PER_KIND + known.size);
  return recent
    .filter((hit) => !known.has(hit.uid))
    .slice(0, missing)
    .map((hit) => ({ kind: 'dashboard', uid: hit.uid, href: hit.url, dashboard: hit }));
}
