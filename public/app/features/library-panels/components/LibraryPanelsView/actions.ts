import { Dispatch } from 'react';
import { AnyAction } from '@reduxjs/toolkit';
import { deleteLibraryPanel as apiDeleteLibraryPanel, getLibraryPanels } from '../../state/api';
import { initialLibraryPanelsViewState, initSearch, LibraryPanelsViewState, searchCompleted } from './reducer';

type DispatchResult = (dispatch: Dispatch<AnyAction>) => void;
type SearchArgs = Pick<LibraryPanelsViewState, 'searchString' | 'perPage' | 'page'>;

export function searchForLibraryPanels(args: SearchArgs): DispatchResult {
  return async function (dispatch) {
    try {
      dispatch(initSearch());
      const { perPage, libraryPanels, page, totalCount } = await getLibraryPanels({
        name: args.searchString,
        perPage: args.perPage,
        page: args.page,
      });
      dispatch(searchCompleted({ libraryPanels, page, perPage, totalCount }));
    } catch (e) {
      dispatch(searchCompleted({ ...initialLibraryPanelsViewState, page: args.page, perPage: args.perPage }));
      console.error(e);
    }
  };
}

export function deleteLibraryPanel(uid: string, args: SearchArgs): DispatchResult {
  return async function (dispatch) {
    try {
      await apiDeleteLibraryPanel(uid);
      await searchForLibraryPanels(args)(dispatch);
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
