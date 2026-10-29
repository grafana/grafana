import impressionSrv from 'app/core/services/impression_srv';
import { type DashboardQueryResult } from 'app/features/search/service/types';

import { searchDashboardsByUid } from './searchDashboardsByUid';

/**
 * Returns dashboard search results ordered the same way the user opened them. Dashboards the user
 * can no longer see are skipped.
 */
export async function getRecentlyViewedDashboards(maxItems = 5): Promise<DashboardQueryResult[]> {
  try {
    const recentlyOpened = (await impressionSrv.getDashboardOpened()).slice(0, maxItems);
    const byUid = await searchDashboardsByUid(recentlyOpened);
    return recentlyOpened.flatMap((uid) => byUid.get(uid) ?? []);
  } catch (error) {
    console.error('Failed to load recently viewed dashboards', error);
    return [];
  }
}
