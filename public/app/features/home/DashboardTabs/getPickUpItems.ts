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
export type PickUpItem =
  | (EntryOf<'dashboard'> & { dashboard: DashboardQueryResult })
  | (EntryOf<'explore'> & { state: string })
  | EntryOf<'alerting' | 'app'>;

/** Rows that made the cut; Explore rows still need their state described. */
type VisibleEntry = Exclude<PickUpItem, { kind: 'explore' }> | EntryOf<'explore'>;

/**
 * Newest first. Dashboards the user can no longer see are dropped before the cap so they cannot
 * consume the display window. A failed dashboard search propagates: one error surface for the tab.
 */
export async function getPickUpItems(maxItems: number): Promise<PickUpItem[]> {
  const entries = await pageHistorySrv.getEntries();
  const dashboards = await findDashboards(entries.flatMap((entry) => (entry.kind === 'dashboard' ? [entry.uid] : [])));

  const visible = entries
    .flatMap((entry): VisibleEntry[] => {
      if (entry.kind !== 'dashboard') {
        return [entry];
      }
      const dashboard = dashboards.get(entry.uid);
      return dashboard ? [{ ...entry, dashboard }] : [];
    })
    .slice(0, maxItems);

  return Promise.all(
    visible.map(async (entry): Promise<PickUpItem> => {
      if (entry.kind !== 'explore') {
        return entry;
      }
      const { search } = new URL(entry.href, 'http://localhost');
      return { ...entry, state: await describeExploreState(search) };
    })
  );
}

async function findDashboards(uids: string[]): Promise<Map<string, DashboardQueryResult>> {
  if (uids.length === 0) {
    return new Map();
  }
  const result = await getGrafanaSearcher().search({ kind: ['dashboard'], uid: uids, limit: uids.length });
  return new Map(result.view.toArray().map((hit) => [hit.uid, hit]));
}
