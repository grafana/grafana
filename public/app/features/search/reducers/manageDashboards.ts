import { SearchAction } from '../types';
import {
  TOGGLE_CAN_SAVE,
  TOGGLE_EDIT_PERMISSIONS,
  TOGGLE_ALL_CHECKED,
  TOGGLE_CHECKED,
  TOGGLE_CAN_MODIFY,
  MOVE_ITEM,
  DELETE_ITEM,
} from './actionTypes';
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
    case TOGGLE_CAN_SAVE:
      return { ...state, canSave: action.payload };
    case TOGGLE_CAN_MODIFY:
      const canMove = state.results.some(result => result.items.some(item => item.checked));
      const canDelete = canMove || state.results.some(result => result.checked);
      return { ...state, canDelete, canMove };
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
            return { ...result, checked: !result.checked };
          }
          return result;
        }),
      };

    case MOVE_ITEM:
      return state;
    case DELETE_ITEM:

    default:
      return state;
  }
};

export const manageDashboardsReducer = mergeReducers([searchReducer, reducer]);
