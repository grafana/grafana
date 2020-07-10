import { DashboardSection, DashboardSectionItem, SearchAction } from '../types';
import { TOGGLE_ALL_CHECKED, TOGGLE_CHECKED, MOVE_ITEMS, DELETE_ITEMS } from './actionTypes';
import { dashboardsSearchState, DashboardsSearchState, searchReducer } from './dashboardSearch';
import { mergeReducers } from '../utils';

export interface ManageDashboardsState extends DashboardsSearchState {
  allChecked: boolean;
}

export const manageDashboardsState: ManageDashboardsState = {
  ...dashboardsSearchState,
  allChecked: false,
};

const reducer = (state: ManageDashboardsState, action: SearchAction) => {
  switch (action.type) {
    case TOGGLE_ALL_CHECKED:
      const newAllChecked = !state.allChecked;
      return {
        ...state,
        results: state.results.map(result => {
          return {
            ...result,
            checked: newAllChecked,
            items: result.items.map(item => ({ ...item, checked: newAllChecked })),
          };
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
    case MOVE_ITEMS: {
      const dashboards: DashboardSectionItem[] = action.payload.dashboards;
      const folder: DashboardSection = action.payload.folder;
      const uids = dashboards.map(db => db.uid);
      return {
        ...state,
        results: state.results.map(result => {
          if (folder.id === result.id) {
            return result.expanded
              ? {
                  ...result,
                  items: [...result.items, ...dashboards.map(db => ({ ...db, checked: false }))],
                  checked: false,
                }
              : result;
          } else {
            return { ...result, items: result.items.filter(item => !uids.includes(item.uid)) };
          }
        }),
      };
    }
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
