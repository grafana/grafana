import { chunk } from 'lodash';

import { DataFrameView } from '@grafana/data';
import { collectionsAPIv1alpha1 } from 'app/api/clients/collections/v1alpha1';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult } from 'app/features/search/service/types';
import { toDashboardResults } from 'app/features/search/service/unified';
import { type ThunkResult } from 'app/types/store';

import { searchAppKindHits } from './kindSearch';
import {
  getStarredKinds,
  type KindSearchStarredKind,
  partitionStarred,
  type StarredNames,
  type StarredNamesOfKind,
} from './kinds';
import { findStarredNames, userStarsFieldSelector } from './utils';

/** Tag for the starred search rows, invalidated by changes that rewrite rows without changing the star set. */
const STARRED_SEARCH_TAG = 'StarredSearch';

// Names per search request. The search is a GET that carries the names in its URL, so a large star set goes in
// several requests rather than one long one.
const NAMES_PER_REQUEST = 50;

// Created once, not per sort
const collator = new Intl.Collator();

/** Rows of the kinds the dashboard search index holds, searched over the union of their starred uids. */
async function searchDashboardIndex(byKind: StarredNamesOfKind[]): Promise<DashboardQueryResult[]> {
  const uids = [...new Set(byKind.flatMap(({ names }) => names))].sort();
  if (uids.length === 0) {
    return [];
  }
  const kinds = byKind.map(({ kind }) => kind.searchKind);
  // A uid is matched against every kind asked for, so a resource of another kind that shares a starred uid
  // comes back too: leave it room in the limit, drop it after.
  const starredBySearchKind = new Map(byKind.map(({ kind, names }) => [kind.searchKind, new Set(names)]));
  const searcher = getGrafanaSearcher();
  const responses = await Promise.all(
    chunk(uids, NAMES_PER_REQUEST).map((names) =>
      searcher.search({ name: names, kind: kinds, limit: names.length * kinds.length })
    )
  );
  return responses
    .flatMap((response) => response.view.toArray())
    .filter((row) => starredBySearchKind.get(row.kind)?.has(row.uid));
}

/** Rows of the app kinds, each through its own search endpoint; a kind whose API is unavailable yields none. */
async function searchAppKinds(
  byKind: Array<StarredNamesOfKind<KindSearchStarredKind>>
): Promise<DashboardQueryResult[]> {
  const hits = await searchAppKindHits(byKind);
  if (hits.length === 0) {
    return [];
  }
  return new DataFrameView<DashboardQueryResult>(toDashboardResults({ hits, totalHits: hits.length }, '')).toArray();
}

const starsAPI = collectionsAPIv1alpha1.enhanceEndpoints({ addTagTypes: [STARRED_SEARCH_TAG] }).injectEndpoints({
  endpoints: (build) => ({
    /**
     * Starred items as search rows, in title order. The star set is the argument, so a changed set is a new cache
     * entry: the previous rows stay up as `data` while it loads, and a late answer for an old set can't overwrite
     * it. RTK holds a slice's tag invalidations while one of its queries is in flight, so a star toggled during
     * this search shows on its button once the search returns.
     */
    searchStarred: build.query<DashboardQueryResult[], StarredNames[]>({
      providesTags: [STARRED_SEARCH_TAG],
      queryFn: async (starred) => {
        const { indexed, app } = partitionStarred(starred);
        try {
          const [indexedRows, appRows] = await Promise.all([searchDashboardIndex(indexed), searchAppKinds(app)]);
          // Each search answers in its own order; sorted together, every kind reads as one list
          return { data: [...indexedRows, ...appRows].sort((a, b) => collator.compare(a.name, b.name)) };
        } catch (error) {
          return { error };
        }
      },
    }),
  }),
});

/**
 * Re-searches the starred rows. Renames and deletions change a row without changing the star set, so nothing the
 * star mutations invalidate would refresh it. Subscribed entries refetch; unmounted ones are dropped and searched
 * again on their next mount. A write to named items goes through `invalidateStarredSearchFor` instead; this form
 * is for a folder delete, which cascades to descendants the client never listed.
 */
export const invalidateStarredSearch = () => starsAPI.util.invalidateTags([STARRED_SEARCH_TAG]);

/**
 * Re-searches the starred rows when one of `uids` is starred, as any kind Grafana shows. A save, rename or delete
 * of an unstarred item changes no row, and most writes are to unstarred items, so the search is spared. Read from
 * the cached star set: the rows are derived from it, so a star it does not hold has no row to refresh either.
 */
export const invalidateStarredSearchFor =
  (uids: string[]): ThunkResult<void> =>
  (dispatch, getState) => {
    const { data } = collectionsAPIv1alpha1.endpoints.listStars.select({ fieldSelector: userStarsFieldSelector() })(
      getState()
    );
    const starredNames = new Set(getStarredKinds().flatMap(({ group, kind }) => findStarredNames(data, group, kind)));
    if (uids.some((uid) => starredNames.has(uid))) {
      dispatch(invalidateStarredSearch());
    }
  };

/**
 * Re-reads the star set and re-searches its rows, for a view that refreshes on its own schedule: stars and renames
 * made elsewhere show at that rate. Invalidation rather than `refetch`, so it holds whether or not the queries have
 * started, and every view sharing the cache follows.
 */
export const refetchStarred = () => starsAPI.util.invalidateTags(['Stars', STARRED_SEARCH_TAG]);

export const { useSearchStarredQuery } = starsAPI;
