import { isEqual } from 'lodash';
import { defer, distinctUntilChanged, filter, finalize, from, map, type Observable, of } from 'rxjs';

import { type StarredResourceRef, type StarsSrv } from '@grafana/runtime';
import { collectionsAPIv1alpha1, type StarsList } from 'app/api/clients/collections/v1alpha1';
import { setStarred } from 'app/core/reducers/navBarTree';
import { contextSrv } from 'app/core/services/context_srv';
import { dispatch, store } from 'app/store/store';

import { findStarredKind, isGrafanaKind, loadStarredKinds, starredNavEntry } from './kinds';
import { findStarredNames, userStarsFieldSelector } from './utils';

/** Stars objects over the collections API and keeps Grafana's Starred nav and lists in sync. */
export class CollectionsStarsSrv implements StarsSrv {
  async canStar(group: string, kind: string): Promise<boolean> {
    await loadStarredKinds();
    return findStarredKind(group, kind) !== undefined;
  }

  star(ref: StarredResourceRef): Promise<void> {
    return this.mutate(ref, true);
  }

  unstar(ref: StarredResourceRef): Promise<void> {
    return this.mutate(ref, false);
  }

  starred(group: string, kind: string): Observable<string[]> {
    // A signed-out user has no stars resource to read, so the set is empty and never changes.
    if (!contextSrv.isSignedIn) {
      return of([]);
    }

    return defer(() => {
      const args = { fieldSelector: userStarsFieldSelector() };
      // Keeps the listStars cache entry alive (and refetching on tag invalidation) while subscribed.
      const query = dispatch(collectionsAPIv1alpha1.endpoints.listStars.initiate(args));
      const select = collectionsAPIv1alpha1.endpoints.listStars.select(args);

      return from(store).pipe(
        map((state) => select(state).data),
        // Hold the first emission until a response exists, so subscribers never see a spurious empty set.
        filter((data): data is StarsList => data !== undefined),
        map((data) => findStarredNames(data, group, kind)),
        distinctUntilChanged(isEqual),
        finalize(() => query.unsubscribe())
      );
    });
  }

  private async mutate(ref: StarredResourceRef, isStarred: boolean): Promise<void> {
    if (!contextSrv.isSignedIn) {
      throw new Error('Cannot change stars while signed out');
    }

    const { group, kind, id, title } = ref;
    const name = `user-${contextSrv.user.uid}`;
    const endpoint = isStarred ? collectionsAPIv1alpha1.endpoints.addStar : collectionsAPIv1alpha1.endpoints.removeStar;

    // Rejects on server error; the Stars tag invalidation refetches listStars so starred() re-emits.
    await dispatch(endpoint.initiate({ id, name, group, kind })).unwrap();

    // A star of a kind Grafana cannot show is stored all the same; only the nav has nothing to do with it
    if (!isGrafanaKind(group, kind)) {
      await loadStarredKinds();
    }
    const starredKind = findStarredKind(group, kind);
    if (starredKind) {
      dispatch(setStarred({ id, title, ...starredNavEntry(starredKind, id), isStarred }));
    }
  }
}
