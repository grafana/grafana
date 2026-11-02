import { collectionsAPIv1alpha1 } from 'app/api/clients/collections/v1alpha1';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult } from 'app/features/search/service/types';

interface SearchStarredArgs {
  /** Starred dashboard uids. */
  dashboards: string[];
  /** Starred folder uids; empty while folders can't be starred. */
  folders: string[];
}

const starsAPI = collectionsAPIv1alpha1.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Starred items as search rows. The star set is the argument, so a changed set is a new cache entry: the
     * previous rows stay up as `data` while it loads, and a late answer for an old set can't overwrite it.
     * RTK holds a slice's tag invalidations while one of its queries is in flight, so a star toggled during this
     * search shows on its button once the search returns.
     */
    searchStarred: build.query<DashboardQueryResult[], SearchStarredArgs>({
      queryFn: async ({ dashboards, folders }) => {
        const uids = [...new Set([...dashboards, ...folders])].sort();
        if (uids.length === 0) {
          return { data: [] };
        }
        const kinds = folders.length ? ['dashboard', 'folder'] : ['dashboard'];
        // A uid is matched against every kind asked for, so a resource of the other kind that shares a starred uid
        // comes back too: leave it room in the limit, drop it after.
        const starredUidsByKind: Record<string, Set<string> | undefined> = {
          dashboard: new Set(dashboards),
          folder: new Set(folders),
        };
        try {
          const response = await getGrafanaSearcher().search({
            name: uids,
            kind: kinds,
            limit: uids.length * kinds.length,
          });
          return { data: response.view.toArray().filter((row) => starredUidsByKind[row.kind]?.has(row.uid)) };
        } catch (error) {
          return { error };
        }
      },
    }),
  }),
});

export const { useSearchStarredQuery } = starsAPI;
