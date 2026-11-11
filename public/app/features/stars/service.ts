import { isEqual } from 'lodash';
import { defer, distinctUntilChanged, filter, finalize, from, map, type Observable, of } from 'rxjs';

import { type StarredResourceRef, type StarsSrv } from '@grafana/runtime';
import { collectionsAPIv1alpha1, type StarsList } from 'app/api/clients/collections/v1alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { dispatch, store } from 'app/store/store';

import { invalidateStarredSearchFor } from './api';
import { findStarredKind, isGrafanaKind, loadStarredKinds, type StarredKind } from './kinds';
import { findStarredNames, userStarsFieldSelector } from './utils';

type StarredObject = Pick<StarredResourceRef, 'group' | 'kind' | 'id'>;

/**
 * Stars objects over the collections API. Every starred view reads the star set and its search rows from RTK
 * cache, so a star change shows through the `Stars` tag the mutations invalidate, and a write to a starred object
 * through a re-search of the rows.
 */
export class CollectionsStarsSrv implements StarsSrv {
  async canStar(group: string, kind: string): Promise<boolean> {
    return (await this.starredKindFor(group, kind)) !== undefined;
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

  resourceUpdated({ id }: StarredObject): void {
    dispatch(invalidateStarredSearchFor([id]));
  }

  resourceDeleted({ id }: StarredObject): void {
    dispatch(invalidateStarredSearchFor([id]));
  }

  private async mutate(ref: StarredResourceRef, isStarred: boolean): Promise<void> {
    if (!contextSrv.isSignedIn) {
      throw new Error('Cannot change stars while signed out');
    }

    const { group, kind, id } = ref;
    const name = `user-${contextSrv.user.uid}`;
    const endpoint = isStarred ? collectionsAPIv1alpha1.endpoints.addStar : collectionsAPIv1alpha1.endpoints.removeStar;

    // Rejects on server error; the Stars tag invalidation refetches listStars, so starred() and every view follow.
    await dispatch(endpoint.initiate({ id, name, group, kind })).unwrap();
  }

  /** The starrable kind behind group/kind. App kinds are discovered first; Grafana's own need no discovery. */
  private async starredKindFor(group: string, kind: string): Promise<StarredKind | undefined> {
    if (!isGrafanaKind(group, kind)) {
      await loadStarredKinds();
    }
    return findStarredKind(group, kind);
  }
}
