import { createAction } from '@reduxjs/toolkit';
import { AnyAction } from 'redux';

import { LoadingState } from '@grafana/data';
import { DashboardSearchHit } from 'app/features/search/types';

export interface DeleteLibraryPanelModalState {
  loadingState: LoadingState;
  dashboardTitles: string[];
}

export const initialDeleteLibraryPanelModalState: DeleteLibraryPanelModalState = {
  loadingState: LoadingState.Loading,
  dashboardTitles: [],
};

export const searchCompleted = createAction<{ dashboards: DashboardSearchHit[] }>(
  'libraryPanels/delete/searchCompleted'
);

export const deleteLibraryPanelModalReducer = (
  state: DeleteLibraryPanelModalState = initialDeleteLibraryPanelModalState,
  action: AnyAction
): DeleteLibraryPanelModalState => {
  if (searchCompleted.match(action)) {
    return {
      ...state,
      dashboardTitles: action.payload.dashboards.map((d) => d.title),
      loadingState: LoadingState.Done,
    };
  }

  return state;
};
