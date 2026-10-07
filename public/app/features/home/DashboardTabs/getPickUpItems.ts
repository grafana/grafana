import { type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { pageHistorySrv } from 'app/core/services/pageHistory/pageHistorySrv';
import {
  DASHBOARD_KEY_PREFIX,
  INVESTIGATION_KEY_PREFIX,
  type PageHistoryEntry,
} from 'app/core/services/pageHistory/types';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult } from 'app/features/search/service/types';

import { describeAppState, describeDashboardState, describeExploreState, getNavTitle } from './describePageState';

export interface PickUpItem {
  entry: PageHistoryEntry;
  title: string;
  /** Folder uid for dashboard rows; resolved to a name via `foldersByUid` by the caller. */
  location?: string;
  /** What the link restores (time range and variables, datasource and query, filters). */
  state: string;
}

/**
 * Newest first. Dashboards the user can no longer see are dropped before the cap so they cannot
 * consume the display window. A failed dashboard search propagates: one error surface for the tab.
 */
export async function getPickUpItems(maxItems: number, navTree: NavModelItem[]): Promise<PickUpItem[]> {
  const entries = await pageHistorySrv.getEntries();
  if (entries.length === 0) {
    return [];
  }

  const uids = entries
    .filter((entry) => entry.kind === 'dashboard')
    .map((entry) => entry.key.slice(DASHBOARD_KEY_PREFIX.length));
  const hitsByUid: Record<string, DashboardQueryResult> = {};
  if (uids.length > 0) {
    const result = await getGrafanaSearcher().search({ kind: ['dashboard'], uid: uids, limit: uids.length });
    for (const hit of result.view.toArray()) {
      hitsByUid[hit.uid] = hit;
    }
  }

  const items: PickUpItem[] = [];
  for (const entry of entries) {
    const { pathname, search } = new URL(entry.href, 'http://localhost');
    const hit = entry.kind === 'dashboard' ? hitsByUid[entry.key.slice(DASHBOARD_KEY_PREFIX.length)] : undefined;
    if (entry.kind === 'dashboard' && !hit) {
      continue;
    }

    let state = '';
    try {
      state = await describeState(entry, pathname, search, navTree);
    } catch {
      // A malformed stored URL never fails the list; the row renders without a state line.
    }
    items.push({ entry, title: getTitle(entry, hit, pathname, navTree), location: hit?.location, state });
  }

  return items.slice(0, maxItems);
}

function getTitle(
  entry: PageHistoryEntry,
  hit: DashboardQueryResult | undefined,
  pathname: string,
  navTree: NavModelItem[]
): string {
  switch (entry.kind) {
    case 'dashboard':
      return hit?.name ?? '';
    case 'explore':
      return t('home.pick-up-tab.explore', 'Explore');
    case 'investigation':
      return t('home.pick-up-tab.investigation', 'Investigation {{id}}', {
        id: entry.key.slice(INVESTIGATION_KEY_PREFIX.length).slice(0, 8),
      });
    case 'alerting':
    case 'app':
      return getNavTitle(navTree, pathname) ?? pathname;
  }
}

async function describeState(
  entry: PageHistoryEntry,
  pathname: string,
  search: string,
  navTree: NavModelItem[]
): Promise<string> {
  switch (entry.kind) {
    case 'dashboard':
      return describeDashboardState(search);
    case 'explore':
      return describeExploreState(search);
    case 'investigation': {
      const pluginId = pathname.split('/')[2];
      return getNavTitle(navTree, `/a/${pluginId}`) ?? pluginId;
    }
    case 'alerting':
    case 'app':
      return describeAppState(search);
  }
}
