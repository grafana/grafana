import { useMemo } from 'react';
import { useAsyncRetry } from 'react-use';

import { useStoredString } from 'app/core/hooks/useStored';
import { pageHistorySrv } from 'app/core/services/pageHistory/pageHistorySrv';
import { type PageHistoryEntry, type PageHistoryKind } from 'app/core/services/pageHistory/types';
import { searchDashboardsByUid } from 'app/features/browse-dashboards/api/searchDashboardsByUid';
import {
  describeExplorePanes,
  type ExploreDataSources,
  type ExplorePaneDescription,
  getExploreDataSources,
} from 'app/features/explore/utils/describeExplorePanes';
import { type DashboardQueryResult } from 'app/features/search/service/types';

/** Last chosen kind filter; remembered per browser. */
const FILTER_KEY = 'grafana.home.recentActivity.filter';
const NO_ITEMS: RecentActivityItem[] = [];
const NO_DATA_SOURCES: ExploreDataSources = new Map();

/** Every kind, in the order the filter and the rows present them; Pages next to Dashboards, as in the nav. */
const PAGE_KINDS: readonly PageHistoryKind[] = ['dashboard', 'page', 'explore', 'alerting', 'app'];

type PageKindCounts = Record<PageHistoryKind, number>;

function countByKind(items: ReadonlyArray<{ kind: PageHistoryKind }>): PageKindCounts {
  const counts: PageKindCounts = { dashboard: 0, page: 0, explore: 0, alerting: 0, app: 0 };
  for (const { kind } of items) {
    counts[kind]++;
  }
  return counts;
}

type EntryOf<K extends PageHistoryKind> = Extract<PageHistoryEntry, { kind: K }>;

/**
 * A history entry plus what needs an async lookup to show it: the search hit that proved the user can
 * still see a dashboard (title, folder), or the datasource names and query text of an Explore page.
 * Formatting happens at render time, in `toRow`.
 */
export type RecentActivityItem =
  | (EntryOf<'dashboard'> & { dashboard: DashboardQueryResult })
  | (EntryOf<'explore'> & { panes: ExplorePaneDescription[] })
  | EntryOf<'page' | 'alerting' | 'app'>;

export type RecentActivityFilter = PageHistoryKind | 'all';

export interface RecentActivity {
  /** Rows after the kind filter, newest first. */
  items: RecentActivityItem[];
  /** Kinds with rows anywhere in the history, in display order; the kind filter offers exactly these. */
  kinds: PageHistoryKind[];
  /** Per kind over the whole history, for what analytics report; the kind filter does not change it. */
  counts: PageKindCounts;
  /** Over the whole history. */
  total: number;
  filter: RecentActivityFilter;
  setFilter: (filter: RecentActivityFilter) => void;
  loading: boolean;
  error: Error | undefined;
  retry: () => void;
  clear: () => Promise<void>;
}

/**
 * Newest first. The history is already capped per kind, so no display cap is needed. Dashboards the user
 * can no longer see are dropped. A failed dashboard search propagates: one error surface for the tab.
 */
async function getRecentActivity(): Promise<RecentActivityItem[]> {
  const entries = await pageHistorySrv.getEntries();
  const [dashboards, dataSources] = await Promise.all([
    searchDashboardsByUid(entries.flatMap((entry) => (entry.kind === 'dashboard' ? [entry.uid] : []))),
    entries.some((entry) => entry.kind === 'explore') ? getExploreDataSources() : NO_DATA_SOURCES,
  ]);
  return entries.flatMap((entry): RecentActivityItem[] => {
    switch (entry.kind) {
      case 'dashboard': {
        const dashboard = dashboards.get(entry.uid);
        return dashboard ? [{ ...entry, dashboard }] : [];
      }
      case 'explore':
        return [{ ...entry, panes: describeExplorePanes(entry.search, dataSources) }];
      default:
        return [entry];
    }
  });
}

/** The whole history is fetched once; the kind filter is applied here, so switching it never refetches. */
export function useRecentActivity(): RecentActivity {
  const { value, loading, error, retry } = useAsyncRetry(getRecentActivity, []);
  const [storedFilter, setStoredFilter] = useStoredString(FILTER_KEY, 'all');

  const all = value ?? NO_ITEMS;
  // Stable per fetch, so the tab's "shown" effect keys on the data and not on every render.
  const counts = useMemo(() => countByKind(all), [all]);
  const kinds = useMemo(() => PAGE_KINDS.filter((kind) => counts[kind] > 0), [counts]);
  // localStorage is untrusted and a filter can outlive its rows (history cleared elsewhere, dashboards
  // deleted); anything but a kind that has rows shows every kind.
  const filter: RecentActivityFilter = kinds.find((kind) => kind === storedFilter) ?? 'all';

  return {
    items: filter === 'all' ? all : all.filter((item) => item.kind === filter),
    kinds,
    counts,
    total: all.length,
    filter,
    setFilter: setStoredFilter,
    loading,
    error,
    retry,
    clear: async () => {
      await pageHistorySrv.clear();
      // The stored filter would otherwise come back as soon as a page of its kind is visited again.
      setStoredFilter('all');
      retry();
    },
  };
}
