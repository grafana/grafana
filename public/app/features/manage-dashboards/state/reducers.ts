import _ from 'lodash';
import { contextSrv } from '../../../core/services/context_srv';
import { DashboardListItem, ManageDashboardState } from 'app/types';
import { Action, ActionTypes } from './actions';

export const initialState: ManageDashboardState = {
  manageDashboard: {
    selectAllChecked: false,
    canMove: false,
    canDelete: false,
    canSave: false,
    hasFilters: false,
    tagFilterOptions: [],
    starredFilterOptions: [{ text: 'Filter by Starred', disabled: true }, { text: 'Yes' }, { text: 'No' }],
    folderId: 0,
    folderUid: '',
    hasEditPermissionInFolders: contextSrv.hasEditPermissionInFolders,
    isEditor: contextSrv.isEditor,
    sections: [],
    selectedStarredFilter: '',
    selectedTagFilter: '',
  },
  listItems: [] as DashboardListItem[],
  dashboardQuery: {
    query: '',
    mode: 'tree',
    tag: [],
    starred: false,
    skipRecent: false,
    skipStarred: false,
    folderIds: [],
  },
};

export const manageDashboardsReducer = (state = initialState, action: Action): ManageDashboardState => {
  switch (action.type) {
    case ActionTypes.SetDashboardSearchQuery:
      return { ...state, dashboardQuery: { ...state.dashboardQuery, query: action.payload } };

    case ActionTypes.RemoveStarredFilter:
      return { ...state, dashboardQuery: { ...state.dashboardQuery, starred: false } };

    case ActionTypes.RemoveTag:
      return {
        ...state,
        dashboardQuery: { ...state.dashboardQuery, tag: _.without(state.dashboardQuery.tag, action.payload) },
      };

    case ActionTypes.ClearFilters:
      return {
        ...state,
        dashboardQuery: { ...state.dashboardQuery, tag: [], starred: false, query: '' },
      };

    case ActionTypes.SearchDashboards:
      return { ...state, listItems: action.payload };
  }

  return state;
};

export default {
  manageDashboards: manageDashboardsReducer,
};
