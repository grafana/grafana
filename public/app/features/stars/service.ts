import { Observable, of } from 'rxjs';

import { type StarredResourceRef, type StarsSrv } from '@grafana/runtime';
import { collectionsAPIv1alpha1, type StarsList } from 'app/api/clients/collections/v1alpha1';
import { setStarred } from 'app/core/reducers/navBarTree';
import { contextSrv } from 'app/core/services/context_srv';
import { dispatch, store } from 'app/store/store';

import { findStarredKind, loadStarredKinds, starredNavEntry } from './kinds';
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

    return new Observable<string[]>((subscriber) => {
      const args = { fieldSelector: userStarsFieldSelector() };
      // Keeps the listStars cache entry alive (and refetching on tag invalidation) while subscribed.
      const querySub = dispatch(collectionsAPIv1alpha1.endpoints.listStars.initiate(args));
      const select = collectionsAPIv1alpha1.endpoints.listStars.select(args);

      let lastData: StarsList | undefined;
      let lastNames: string[] | undefined;

      const emit = () => {
        const { data } = select(store.getState());
        if (data === lastData) {
          return;
        }
        lastData = data;
        // Hold the first emission until a response exists, so subscribers never see a spurious empty set.
        if (!data) {
          return;
        }
        const names = findStarredNames(data, group, kind);
        if (lastNames && lastNames.length === names.length && lastNames.every((n, i) => n === names[i])) {
          return;
        }
        lastNames = names;
        subscriber.next(names);
      };

      emit();
      const storeUnsub = store.subscribe(emit);

      return () => {
        storeUnsub();
        querySub.unsubscribe();
      };
    });
  }

  private async mutate(ref: StarredResourceRef, isStarred: boolean): Promise<void> {
    if (!contextSrv.isSignedIn) {
      throw new Error('Cannot change stars while signed out');
    }

    const { group, kind, id, title } = ref;
    // The server stores a star of any kind, but only declared kinds can be shown anywhere, so refuse the rest here
    await loadStarredKinds();
    const starredKind = findStarredKind(group, kind);
    if (!starredKind) {
      throw new Error(`Cannot star ${group}/${kind}: no installed app plugin declares it as starrable`);
    }

    const name = `user-${contextSrv.user.uid}`;
    const endpoint = isStarred ? collectionsAPIv1alpha1.endpoints.addStar : collectionsAPIv1alpha1.endpoints.removeStar;

    // Rejects on server error; the Stars tag invalidation refetches listStars so starred() re-emits.
    await dispatch(endpoint.initiate({ id, name, group, kind })).unwrap();

    dispatch(setStarred({ id, title, ...starredNavEntry(starredKind, id), isStarred }));
  }
}
