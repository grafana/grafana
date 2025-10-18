import { Action } from '@reduxjs/toolkit';
import { Dispatch } from 'react';
import { from, merge, of, Subscription, timer } from 'rxjs';
import { catchError, finalize, mapTo, mergeMap, share, takeUntil } from 'rxjs/operators';

import { deleteLibraryPanel as apiDeleteLibraryPanel, getLibraryPanels } from '../../state/api';

import { initialLibraryPanelsViewState, initSearch, searchCompleted } from './reducer';

type SearchDispatchResult = (dispatch: Dispatch<Action>, abortController?: AbortController) => void;

interface SearchArgs {
  perPage: number;
  page: number;
  searchString: string;
  sortDirection?: string;
  panelFilter?: string[];
  folderFilterUIDs?: string[];
  currentPanelId?: string;
}

export function searchForLibraryPanels(args: SearchArgs): SearchDispatchResult {
  // Functions to support filtering out library panels per plugin type that have skipDataQuery set to true

  return function (dispatch, abortController) {
    const subscription = new Subscription();
    const dataObservable = from(
      getLibraryPanels({
        searchString: args.searchString,
        perPage: args.perPage,
        page: args.page,
        excludeUid: args.currentPanelId,
        sortDirection: args.sortDirection,
        typeFilter: args.panelFilter,
        folderFilterUIDs: args.folderFilterUIDs,
        signal: abortController?.signal,
      })
    ).pipe(
      //filter out library panels per plugin type that have skipDataQuery set to true
      mergeMap((libraryPanelsResult) => {
        const { elements: libraryPanels } = libraryPanelsResult;
        return of({ ...libraryPanelsResult, elements: libraryPanels });
      }),
      mergeMap(({ perPage, elements: libraryPanels, page, totalCount }) =>
        of(searchCompleted({ libraryPanels, page, perPage, totalCount }))
      ),
      catchError((err) => {
        // Check if this is an aborted request - if so, silently ignore it
        const isAbortError =
          err.name === 'AbortError' || err.cancelled === true || err.statusText === 'Request was aborted';

        if (isAbortError) {
          return of(); // Silently ignore aborted requests
        }

        // For real errors, log and show error to user
        console.error('Error fetching library panels:', err);

        // Update state to show empty results
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

export function deleteLibraryPanel(uid: string, args: SearchArgs) {
  return async function (dispatch: Dispatch<Action>) {
    try {
      await apiDeleteLibraryPanel(uid);
      searchForLibraryPanels(args)(dispatch);
    } catch (e) {
      console.error(e);
    }
  };
}

export function asyncDispatcher(dispatch: Dispatch<Action>) {
  return function (action: Action | SearchDispatchResult | Function, abortController?: AbortController) {
    if (action instanceof Function) {
      return action(dispatch, abortController);
    }
    return dispatch(action);
  };
}
