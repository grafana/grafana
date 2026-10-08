import { useAsyncRetry } from 'react-use';

import { useStoredString } from 'app/core/hooks/useStored';
import { pageHistorySrv } from 'app/core/services/pageHistory/pageHistorySrv';
import { type PageHistoryEntry, type PageHistoryKind } from 'app/core/services/pageHistory/types';
import { searchDashboardsByUid } from 'app/features/browse-dashboards/api/searchDashboardsByUid';
import { describeExplorePanes, type ExplorePaneDescription } from 'app/features/explore/utils/describeExplorePanes';
import { type DashboardQueryResult } from 'app/features/search/service/types';

import { countByKind, PAGE_KINDS } from './pageKinds';

/** Last chosen kind filter; remembered per browser. */
const FILTER_KEY = 'grafana.home.recentActivity.filter';

type EntryOf<K extends PageHistoryKind> = Extract<PageHistoryEntry, { kind: K }>;

/**
 * A history entry plus what needs an async lookup to show it: the search hit that proved the user can
 * still see a dashboard (title, folder), or the datasource names and query text of an Explore page.
 * Formatting happens at render time.
 */
export type RecentActivityItem =
  | (EntryOf<'dashboard'> & { dashboard: DashboardQueryResult })
  | (EntryOf<'explore'> & { panes: ExplorePaneDescription[] })
  | EntryOf<'alerting' | 'app'>;

/** `''` shows every kind. */
export type RecentActivityFilter = PageHistoryKind | '';

/**
 * Newest first. The history is already capped per kind, so no display cap is needed. Dashboards the user
 * can no longer see are dropped. A failed dashboard search propagates: one error surface for the tab.
 */
async function getRecentActivity(): Promise<RecentActivityItem[]> {
  const entries = await pageHistorySrv.getEntries();
  // Not awaited here so the Explore lookups below run alongside the search.
  const dashboards = searchDashboardsByUid(entries.flatMap((entry) => (entry.kind === 'dashboard' ? [entry.uid] : [])));
  const items = await Promise.all(
    entries.map(async (entry): Promise<RecentActivityItem | undefined> => {
      switch (entry.kind) {
        case 'dashboard': {
          const dashboard = (await dashboards).get(entry.uid);
          return dashboard && { ...entry, dashboard };
        }
        case 'explore':
          return { ...entry, panes: await describeExplorePanes(entry.search) };
        default:
          return entry;
      }
    })
  );
  return items.filter((item) => item !== undefined);
}

/** The whole history is fetched once; the kind filter is applied here, so switching it never refetches. */
export function useRecentActivity() {
  const { value, loading, error, retry } = useAsyncRetry(getRecentActivity, []);
  const [storedFilter, setStoredFilter] = useStoredString(FILTER_KEY, '');

  const all = value ?? [];
  const counts = countByKind(all);
  // localStorage is untrusted and a filter can outlive its rows (history cleared elsewhere, dashboards
  // deleted); anything but a kind that has rows shows every kind.
  const filter: RecentActivityFilter = PAGE_KINDS.find((kind) => kind === storedFilter && counts[kind] > 0) ?? '';
  const setFilter: (filter: RecentActivityFilter) => void = setStoredFilter;

  return {
    /** Rows after the kind filter, newest first. */
    items: filter ? all.filter((item) => item.kind === filter) : all,
    /** Per kind over the whole history, so disabled filter options follow what each kind would reveal. */
    counts,
    total: all.length,
    filter,
    setFilter,
    loading,
    error,
    retry,
    clear: async () => {
      await pageHistorySrv.clear();
      // The stored filter would otherwise come back as soon as a page of its kind is visited again.
      setStoredFilter('');
      retry();
    },
  };
}
