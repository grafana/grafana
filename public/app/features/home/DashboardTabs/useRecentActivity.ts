import { useMemo } from 'react';
import { useAsyncRetry } from 'react-use';

import { useStoredString } from 'app/core/hooks/useStored';
import { pageHistorySrv } from 'app/core/services/pageHistory/pageHistorySrv';
import { type PageHistoryKind } from 'app/core/services/pageHistory/types';
import { searchDashboardsByUid } from 'app/features/browse-dashboards/api/searchDashboardsByUid';
import {
  describeExplorePanes,
  type ExploreDataSources,
  getExploreDataSources,
} from 'app/features/explore/utils/describeExplorePanes';

import { countByKind, PAGE_KINDS, type PageKindCounts, type RecentActivityItem } from './recentActivityRows';

/** Last chosen kind filter; remembered per browser. */
const FILTER_KEY = 'grafana.home.recentActivity.filter';
const NO_ITEMS: RecentActivityItem[] = [];
const NO_DATA_SOURCES: ExploreDataSources = new Map();

/** `''` shows every kind. */
export type RecentActivityFilter = PageHistoryKind | '';

export interface RecentActivity {
  /** Rows after the kind filter, newest first. */
  items: RecentActivityItem[];
  /** Per kind over the whole history, so the filter options and what analytics report follow it, not the filtered rows. */
  counts: PageKindCounts;
  /** Over the whole history. */
  total: number;
  filter: RecentActivityFilter;
  setFilter: (filter: RecentActivityFilter) => void;
  loading: boolean;
  error: Error | undefined;
  /** The list is what the tab shows: loaded, no error, and the history has rows. The footer belongs to the list. */
  hasRows: boolean;
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
  const [storedFilter, setStoredFilter] = useStoredString(FILTER_KEY, '');

  const all = value ?? NO_ITEMS;
  // Stable per fetch, so the tab's "shown" effect keys on the data and not on every render.
  const counts = useMemo(() => countByKind(all), [all]);
  // localStorage is untrusted and a filter can outlive its rows (history cleared elsewhere, dashboards
  // deleted); anything but a kind that has rows shows every kind.
  const filter: RecentActivityFilter = PAGE_KINDS.find((kind) => kind === storedFilter && counts[kind] > 0) ?? '';

  return {
    items: filter ? all.filter((item) => item.kind === filter) : all,
    counts,
    total: all.length,
    filter,
    setFilter: setStoredFilter,
    loading,
    error,
    hasRows: !loading && !error && all.length > 0,
    retry,
    clear: async () => {
      await pageHistorySrv.clear();
      // The stored filter would otherwise come back as soon as a page of its kind is visited again.
      setStoredFilter('');
      retry();
    },
  };
}
