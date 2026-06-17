import { type StarsList } from 'app/api/clients/collections/v1alpha1';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { queryResultToViewItem } from 'app/features/search/service/utils';
import { type DashboardViewItem } from 'app/features/search/types';

/**
 * Resolves the current user's explicitly-starred folders to view items with real backend UIDs. The
 * stars API stores only UIDs, so titles/URLs are looked up by name through the unified searcher.
 */
export async function resolveStarredFolders(stars: StarsList | undefined): Promise<DashboardViewItem[]> {
  const uids =
    stars?.items?.[0]?.spec.resource.find((r) => r.group === 'folder.grafana.app' && r.kind === 'Folder')?.names ?? [];
  if (uids.length === 0) {
    return [];
  }

  const { view } = await getGrafanaSearcher().search({ kind: ['folder'], name: uids, limit: uids.length });
  return view.map((item) => queryResultToViewItem(item, view));
}
