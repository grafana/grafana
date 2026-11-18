import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult } from 'app/features/search/service/types';

/** The dashboards among `uids` the user can see, keyed by uid. One search call; none for an empty list. */
export async function searchDashboardsByUid(uids: string[]): Promise<Map<string, DashboardQueryResult>> {
  if (uids.length === 0) {
    return new Map();
  }
  const result = await getGrafanaSearcher().search({ kind: ['dashboard'], uid: uids, limit: uids.length });
  return new Map(result.view.toArray().map((hit) => [hit.uid, hit]));
}
