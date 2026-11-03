import { DataFrameView } from '@grafana/data';
import { collectionsAPIv1alpha1 } from 'app/api/clients/collections/v1alpha1';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult } from 'app/features/search/service/types';
import { toDashboardResults } from 'app/features/search/service/unified';

import { searchStarredHits } from './kindSearch';
import { findStarredKind, type KindSearchStarredKind, resolvesThroughKindSearch, type StarredKind } from './kinds';

/** The starred names of one kind, as the Stars resource stores them. */
interface StarredNames {
  group: string;
  kind: string;
  names: string[];
}

type StarredNamesOfKind<K extends StarredKind = StarredKind> = { kind: K; names: string[] };

/** Rows of the kinds the dashboard search index holds, in one search over the union of their starred uids. */
async function searchDashboardIndex(byKind: StarredNamesOfKind[]): Promise<DashboardQueryResult[]> {
  const uids = [...new Set(byKind.flatMap(({ names }) => names))].sort();
  if (uids.length === 0) {
    return [];
  }
  const kinds = byKind.map(({ kind }) => kind.searchKind);
  // A uid is matched against every kind asked for, so a resource of another kind that shares a starred uid
  // comes back too: leave it room in the limit, drop it after.
  const starredBySearchKind = new Map(byKind.map(({ kind, names }) => [kind.searchKind, new Set(names)]));
  const response = await getGrafanaSearcher().search({ name: uids, kind: kinds, limit: uids.length * kinds.length });
  return response.view.toArray().filter((row) => starredBySearchKind.get(row.kind)?.has(row.uid));
}

/** Rows of the app kinds, each through its own search endpoint; a kind whose API is unavailable yields none. */
async function searchAppKinds(
  byKind: Array<StarredNamesOfKind<KindSearchStarredKind>>
): Promise<DashboardQueryResult[]> {
  const hits = (await Promise.all(byKind.map(({ kind, names }) => searchStarredHits(kind, names)))).flat();
  if (hits.length === 0) {
    return [];
  }
  return new DataFrameView<DashboardQueryResult>(toDashboardResults({ hits, totalHits: hits.length }, '')).toArray();
}

const starsAPI = collectionsAPIv1alpha1.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Starred items as search rows. The star set is the argument, so a changed set is a new cache entry: the
     * previous rows stay up as `data` while it loads, and a late answer for an old set can't overwrite it.
     * RTK holds a slice's tag invalidations while one of its queries is in flight, so a star toggled during this
     * search shows on its button once the search returns.
     */
    searchStarred: build.query<DashboardQueryResult[], StarredNames[]>({
      queryFn: async (starred) => {
        const byKind = starred.flatMap(({ group, kind, names }): StarredNamesOfKind[] => {
          const starredKind = findStarredKind(group, kind);
          return starredKind && names.length > 0 ? [{ kind: starredKind, names }] : [];
        });
        const appKinds = byKind.flatMap(({ kind, names }) =>
          resolvesThroughKindSearch(kind) ? [{ kind, names }] : []
        );
        try {
          // The app rows trail the indexed rows, which keep the order the search gave them
          const [indexed, apps] = await Promise.all([
            searchDashboardIndex(byKind.filter(({ kind }) => !resolvesThroughKindSearch(kind))),
            searchAppKinds(appKinds),
          ]);
          return { data: [...indexed, ...apps] };
        } catch (error) {
          return { error };
        }
      },
    }),
  }),
});

export const { useSearchStarredQuery } = starsAPI;
