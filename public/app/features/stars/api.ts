import { collectionsAPIv1alpha1 } from 'app/api/clients/collections/v1alpha1';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult } from 'app/features/search/service/types';

export interface SearchStarredArgs {
  /** Starred dashboard uids. */
  dashboards: string[];
  /** Starred folder uids; empty while folders can't be starred. */
  folders: string[];
  /** Cap on the starred uids searched, in uid order. */
  limit: number;
}

export interface StarredSearch {
  /** The starred uids the rows were searched for, deduped across kinds and capped. */
  uids: string[];
  rows: DashboardQueryResult[];
}

/**
 * Starred items as search rows. The star set is the argument, so a changed set is a new cache entry: the previous
 * rows stay up as `data` while it loads, and a late answer for an old set can't overwrite it.
 */
export const starsAPI = collectionsAPIv1alpha1.injectEndpoints({
  endpoints: (build) => ({
    searchStarred: build.query<StarredSearch, SearchStarredArgs>({
      queryFn: async ({ dashboards, folders, limit }) => {
        // Deduped so a uid starred as both kinds is searched for, and listed, once.
        const uids = [...new Set([...dashboards, ...folders])].sort().slice(0, limit);
        if (uids.length === 0) {
          return { data: { uids, rows: [] } };
        }
        // The search matches the uid union against every kind asked for, so a uid starred as one kind must not
        // surface a row of the other: keep only kind-matching hits.
        const starredUidsByKind: Record<string, Set<string> | undefined> = {
          dashboard: new Set(dashboards),
          folder: new Set(folders),
        };
        try {
          const response = await getGrafanaSearcher().search({
            name: uids,
            kind: folders.length ? ['dashboard', 'folder'] : ['dashboard'],
          });
          const rows = response.view.toArray().filter((row) => starredUidsByKind[row.kind]?.has(row.uid));
          return { data: { uids, rows } };
        } catch (error) {
          return { error };
        }
      },
    }),
  }),
});

export const { useSearchStarredQuery } = starsAPI;
