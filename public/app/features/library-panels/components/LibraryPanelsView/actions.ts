import { Dispatch } from 'react';
import { AnyAction } from '@reduxjs/toolkit';
import { from, merge, of, Subscription, timer } from 'rxjs';
import { catchError, finalize, mapTo, mergeMap, share, takeUntil } from 'rxjs/operators';

import { deleteLibraryPanel as apiDeleteLibraryPanel, getLibraryPanels } from '../../state/api';
import { initialLibraryPanelsViewState, initSearch, LibraryPanelsViewState, searchCompleted } from './reducer';
import { DispatchResult } from '../../types';

type SearchArgs = Pick<LibraryPanelsViewState, 'searchString' | 'perPage' | 'page' | 'currentPanelId'>;

export function searchForLibraryPanels(args: SearchArgs): DispatchResult {
  return function (dispatch) {
    const subscription = new Subscription();
    const dataObservable = from(
      getLibraryPanels({
        name: args.searchString,
        perPage: args.perPage,
        page: args.page,
        excludeUid: args.currentPanelId,
      })
    ).pipe(
      mergeMap(({ perPage, libraryPanels, page, totalCount }) =>
        of(searchCompleted({ libraryPanels, page, perPage, totalCount }))
      ),
      catchError((err) => {
        console.error(err);
        return of(searchCompleted({ ...initialLibraryPanelsViewState, page: args.page, perPage: args.perPage }));
      }),
      finalize(() => subscription.unsubscribe()), // make sure we unsubscribe
      share()
    );

    subscription.add(
      // If 50ms without a response dispatch a loading state
      // mapTo will translate the timer event into a loading state
      // takeUntil will cancel the timer emit when first response is received on the dataObservable
      merge(timer(50).pipe(mapTo(initSearch()), takeUntil(dataObservable)), dataObservable).subscribe(dispatch)
    );
  };
}

export function deleteLibraryPanel(uid: string, args: SearchArgs): DispatchResult {
  return async function (dispatch) {
    try {
      await apiDeleteLibraryPanel(uid);
      searchForLibraryPanels(args)(dispatch);
    } catch (e) {
      console.error(e);
    }
  };
}

export function asyncDispatcher(dispatch: Dispatch<AnyAction>) {
  return function (action: any) {
    if (action instanceof Function) {
      return action(dispatch);
    }
    return dispatch(action);
  };
}
