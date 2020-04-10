import { SearchAction } from '../types';
import { TOGGLE_FOLDER_CAN_SAVE, TOGGLE_EDIT_PERMISSIONS, TOGGLE_ALL_CHECKED } from './actionTypes';
import { dashboardsSearchState, DashboardsSearchState, searchReducer } from './dashboardSearch';
import { mergeReducers } from '../utils';

export interface ManageDashboardsState extends DashboardsSearchState {
  canMove: boolean;
  canDelete: boolean;
  canSave: boolean;
  allChecked: boolean;
  hasEditPermissionInFolders: boolean;
}

export const manageDashboardsState: ManageDashboardsState = {
  ...dashboardsSearchState,
  canMove: false,
  canDelete: false,
  canSave: false,
  allChecked: false,
  hasEditPermissionInFolders: false,
};

const reducer = (state: ManageDashboardsState, action: SearchAction) => {
  switch (action.type) {
    case TOGGLE_FOLDER_CAN_SAVE:
      return { ...state, canSave: action.payload };
    case TOGGLE_EDIT_PERMISSIONS:
      return { ...state, hasEditPermissionInFolders: action.payload };
    case TOGGLE_ALL_CHECKED:
      const newAllChecked = !state.allChecked;
      return {
        ...state,
        results: state.results.map(result => {
          return { ...result, checked: newAllChecked };
        }),
        allChecked: newAllChecked,
      };

    default:
      return state;
  }
};

export const manageDashboardsReducer = mergeReducers([searchReducer, reducer]);
