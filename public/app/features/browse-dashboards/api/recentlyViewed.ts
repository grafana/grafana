import impressionSrv from 'app/core/services/impression_srv';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { DashboardQueryResult } from 'app/features/search/service/types';

/**
 * Returns dashboard search results ordered the same way the user opened them.
 */
export async function getRecentlyViewedDashboards(maxItems = 5): Promise<DashboardQueryResult[]> {
  try {
    const recentlyOpened = (await impressionSrv.getDashboardOpened()).slice(0, maxItems);
    if (!recentlyOpened.length) {
      return [];
    }

    const searchResults = await getGrafanaSearcher().search({
      kind: ['dashboard'],
      limit: recentlyOpened.length,
      uid: recentlyOpened,
    });

    const dashboards = searchResults.view.toArray();
    // Keep dashboards in the same order the user opened them.
    // When a UID is missing from the search response
    // push it to the end instead of letting indexOf return -1
    const order = (uid: string) => {
      const idx = recentlyOpened.indexOf(uid);
      return idx === -1 ? recentlyOpened.length : idx;
    };

    dashboards.sort((a, b) => order(a.uid) - order(b.uid));
    return dashboards;
  } catch (error) {
    console.error('Failed to load recently viewed dashboards', error);
    return [];
  }
}
