import { SearchAction } from '../types';
import {
  TOGGLE_CAN_SAVE,
  TOGGLE_EDIT_PERMISSIONS,
  TOGGLE_ALL_CHECKED,
  TOGGLE_CHECKED,
  MOVE_ITEM,
  DELETE_ITEM,
} from './actionTypes';
import { dashboardsSearchState, DashboardsSearchState, searchReducer } from './dashboardSearch';
import { mergeReducers } from '../utils';

export interface ManageDashboardsState extends DashboardsSearchState {
  canSave: boolean;
  allChecked: boolean;
  hasEditPermissionInFolders: boolean;
}

export const manageDashboardsState: ManageDashboardsState = {
  ...dashboardsSearchState,
  canSave: false,
  allChecked: false,
  hasEditPermissionInFolders: false,
};

const reducer = (state: ManageDashboardsState, action: SearchAction) => {
  switch (action.type) {
    case TOGGLE_CAN_SAVE:
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
    case TOGGLE_CHECKED:
      return {
        ...state,
        results: state.results.map(result => {
          if (result.id === action.payload.id) {
            return {
              ...result,
              checked: !result.checked,
              items: result.items.map(item => ({ ...item, checked: !result.checked })),
            };
          }
          return result;
        }),
      };

    case MOVE_ITEM:
      return state;
    case DELETE_ITEM:
      return state;
    default:
      return state;
  }
};

export const manageDashboardsReducer = mergeReducers([searchReducer, reducer]);
