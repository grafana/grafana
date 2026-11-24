import { chunk } from 'lodash';

import { collectionsAPIv1alpha1 } from 'app/api/clients/collections/v1alpha1';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult } from 'app/features/search/service/types';
import { type ThunkResult } from 'app/types/store';

import { STARRED_KINDS } from './kinds';
import { findStarredNames, userStarsFieldSelector } from './utils';

/** The starred names of one search kind. */
interface StarredNames {
  kind: string;
  names: string[];
}

/** Tag for the starred search rows, invalidated by changes that rewrite rows without changing the star set. */
const STARRED_SEARCH_TAG = 'StarredSearch';

// Names per search request. The search is a GET that carries the names in its URL, so a large star set goes in
// several requests rather than one long one.
const NAMES_PER_REQUEST = 50;

// Created once, not per sort
const collator = new Intl.Collator();

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
        const uids = [...new Set(starred.flatMap(({ names }) => names))].sort();
        if (uids.length === 0) {
          return { data: [] };
        }
        const kinds = starred.map(({ kind }) => kind);
        // A uid is matched against every kind asked for, so a resource of another kind that shares a starred uid
        // comes back too: leave it room in the limit, drop it after.
        const starredByKind = new Map(starred.map(({ kind, names }) => [kind, new Set(names)]));
        try {
          const searcher = getGrafanaSearcher();
          const responses = await Promise.all(
            chunk(uids, NAMES_PER_REQUEST).map((names) =>
              searcher.search({ name: names, kind: kinds, limit: names.length * kinds.length })
            )
          );
          // Each response is in title order; merged, the rows are sorted again so a star set that takes several
          // requests reads like one that takes one
          const rows = responses
            .flatMap((response) => response.view.toArray())
            .filter((row) => starredByKind.get(row.kind)?.has(row.uid))
            .sort((a, b) => collator.compare(a.name, b.name));
          return { data: rows };
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
 * Re-searches the starred rows when one of `uids` is starred, as any kind. A save, rename or delete of an unstarred
 * item changes no row, and most writes are to unstarred items, so the search is spared. Read from the cached star
 * set: the rows are derived from it, so a star it does not hold has no row to refresh either.
 */
export const invalidateStarredSearchFor =
  (uids: string[]): ThunkResult<void> =>
  (dispatch, getState) => {
    const { data } = collectionsAPIv1alpha1.endpoints.listStars.select({ fieldSelector: userStarsFieldSelector() })(
      getState()
    );
    const starredNames = new Set(STARRED_KINDS.flatMap(({ group, kind }) => findStarredNames(data, group, kind)));
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
