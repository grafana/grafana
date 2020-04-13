import { SearchAction } from '../types';
import {
  TOGGLE_CAN_SAVE,
  TOGGLE_EDIT_PERMISSIONS,
  TOGGLE_ALL_CHECKED,
  TOGGLE_CHECKED,
  MOVE_ITEMS,
  DELETE_ITEMS,
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
      const { id } = action.payload;
      return {
        ...state,
        results: state.results.map(result => {
          if (result.id === id) {
            return {
              ...result,
              checked: !result.checked,
              items: result.items.map(item => ({ ...item, checked: !result.checked })),
            };
          }
          return {
            ...result,
            items: result.items.map(item => (item.id === id ? { ...item, checked: !item.checked } : item)),
          };
        }),
      };
    case MOVE_ITEMS:
      return state;
    case DELETE_ITEMS: {
      const { folders, dashboards } = action.payload;
      if (!folders.length && !dashboards.length) {
        return state;
      }
      return {
        ...state,
        results: state.results.reduce((filtered, result) => {
          if (!folders.includes(result.uid)) {
            return [...filtered, { ...result, items: result.items.filter(item => !dashboards.includes(item.uid)) }];
          }
          return filtered;
        }, []),
      };
    }
    default:
      return state;
  }
};

export const manageDashboardsReducer = mergeReducers([searchReducer, reducer]);
