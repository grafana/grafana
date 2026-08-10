import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { queryResultToViewItem } from 'app/features/search/service/utils';
import { type DashboardViewItem } from 'app/features/search/types';
import { type PermissionLevel } from 'app/types/acl';

/**
 * Resolves starred folder UIDs to view items with real backend UIDs. The stars API stores only UIDs,
 * so titles/URLs are looked up by name through the unified searcher.
 */
export async function resolveStarredFolders(
  uids: string[],
  permission?: PermissionLevel
): Promise<DashboardViewItem[]> {
  if (uids.length === 0) {
    return [];
  }

  const { view } = await getGrafanaSearcher().search({ kind: ['folder'], name: uids, limit: uids.length, permission });
  return view.map((item) => queryResultToViewItem(item, view));
}
