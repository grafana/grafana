import { isEqual } from 'lodash';
import { defer, distinctUntilChanged, filter, finalize, from, map, type Observable, of } from 'rxjs';

import { type StarredResourceRef, type StarsSrv } from '@grafana/runtime/unstable';
import { collectionsAPIv1alpha1 } from 'app/api/clients/collections/v1alpha1';
import { dispatch, getState, store } from 'app/store/store';

import { invalidateStarredSearch, selectUserStars, setStarred } from './api';
import { refetchStarredAppKinds } from './kindSearch';
import { findStarredKind, STARRED_INDEX_KINDS } from './kinds';
import { canUseStars, findStarredNames, userStarsFieldSelector } from './utils';

function starred(group: string, kind: string): Observable<readonly string[]> {
  // A user without a stars resource has nothing starred, so the set is empty and never changes
  if (!canUseStars()) {
    return of([]);
  }

  return defer(() => {
    const args = { fieldSelector: userStarsFieldSelector() };
    // Keeps the listStars cache entry alive (and refetching on tag invalidation) while subscribed.
    const query = dispatch(collectionsAPIv1alpha1.endpoints.listStars.initiate(args));
    const select = collectionsAPIv1alpha1.endpoints.listStars.select(args);

    return from(store).pipe(
      map((state) => select(state)),
      // Hold the first emission until the read settles, so subscribers never see a spurious empty set.
      // A failed read is an empty set, not an error: an error would end the stream before a later read succeeds.
      filter(({ data, isError }) => data !== undefined || isError),
      map(({ data }) => findStarredNames(data, group, kind)),
      distinctUntilChanged(isEqual),
      finalize(() => query.unsubscribe())
    );
  });
}

/**
 * Searches again for the row of an object after a write to it. A write to an object that is not starred changes no
 * row, so the search is spared.
 */
function searchAgain({ group, kind, name }: StarredResourceRef): void {
  const starredKind = findStarredKind(group, kind);
  if (!starredKind || !findStarredNames(selectUserStars(getState()), group, kind).includes(name)) {
    return;
  }
  // The dashboard index lists its own kinds; an app kind is searched through its plugin's API
  dispatch(STARRED_INDEX_KINDS.includes(starredKind) ? invalidateStarredSearch() : refetchStarredAppKinds());
}

/**
 * The stars service that app plugins get through `getStarsSrv()`. Every starred view reads the star set and its
 * search rows from RTK cache. A star change shows through the `Stars` tag the mutations invalidate, and a write to
 * a starred object through a new search of its row.
 */
export const starsSrv: StarsSrv = {
  showsStarsOf: (group, kind) => findStarredKind(group, kind) !== undefined,
  star: (ref) => dispatch(setStarred(ref, true)),
  unstar: (ref) => dispatch(setStarred(ref, false)),
  starred,
  resourceUpdated: searchAgain,
  resourceDeleted: searchAgain,
};
