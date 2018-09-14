import { DashboardSection, DashboardSectionItem, StoreState } from 'app/types';
import { ThunkAction } from 'redux-thunk';
import { getSearchSrv } from '../../../core/services/search_srv';
import { getDashboardQuery } from './selectors';
import { getBackendSrv } from '../../../core/services/backend_srv';

export enum ActionTypes {
  LoadSections = 'SECTIONS_LOADED',
  SetDashboardSearchQuery = 'SET_DASHBOARD_SEARCH_QUERY',
  RemoveStarredFilter = 'REMOVE_STARRED_FILTER',
  RemoveTag = 'REMOVE_TAG',
  ClearFilters = 'CLEAR_FILTERS',
  LoadSectionItems = 'LOAD_SECTIONS_ITEMS',
  CollapseSection = 'COLLAPSE_SECTION',
  SetSectionItemSelected = 'SET_ITEM_SELECTED',
  SetSectionSelected = 'SET_SECTION_SELECTED',
}

interface LoadSectionsAction {
  type: ActionTypes.LoadSections;
  payload: any[];
}

interface SetSearchDashboardSearchQueryAction {
  type: ActionTypes.SetDashboardSearchQuery;
  payload: string;
}

interface RemoveStarredFilterAction {
  type: ActionTypes.RemoveStarredFilter;
}

interface RemoveTagAction {
  type: ActionTypes.RemoveTag;
  payload: string;
}

interface LoadSectionItemsAction {
  type: ActionTypes.LoadSectionItems;
  payload: {
    id: number;
    items: DashboardSectionItem[];
  };
}

interface ClearFiltersAction {
  type: ActionTypes.ClearFilters;
}

interface CollapseSectionAction {
  type: ActionTypes.CollapseSection;
  payload: number;
}

interface SetSectionSelectedAction {
  type: ActionTypes.SetSectionSelected;
  payload: number;
}

interface SetSectionItemSelectedAction {
  type: ActionTypes.SetSectionItemSelected;
  payload: {
    folderId: number;
    itemId: number;
  };
}

export type Action =
  | LoadSectionsAction
  | SetSearchDashboardSearchQueryAction
  | RemoveStarredFilterAction
  | RemoveTagAction
  | ClearFiltersAction
  | LoadSectionItemsAction
  | CollapseSectionAction
  | SetSectionSelectedAction
  | SetSectionItemSelectedAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, Action>;

const sectionsLoaded = (sections: DashboardSection[]): LoadSectionsAction => ({
  type: ActionTypes.LoadSections,
  payload: sections,
});

const sectionItemsLoaded = (items: DashboardSectionItem[], id: number): LoadSectionItemsAction => ({
  type: ActionTypes.LoadSectionItems,
  payload: {
    id,
    items,
  },
});

const setDashboardSearchQuery = (searchQuery: string): SetSearchDashboardSearchQueryAction => ({
  type: ActionTypes.SetDashboardSearchQuery,
  payload: searchQuery,
});

export const removeStarredFilter = (): RemoveStarredFilterAction => ({
  type: ActionTypes.RemoveStarredFilter,
});

export const removeTag = (tag: string): RemoveTagAction => ({
  type: ActionTypes.RemoveTag,
  payload: tag,
});

export const clearFilters = (): ClearFiltersAction => ({
  type: ActionTypes.ClearFilters,
});

export const collapseSection = (sectionId: number): CollapseSectionAction => ({
  type: ActionTypes.CollapseSection,
  payload: sectionId,
});

export const setSectionSelected = (folderId: number): SetSectionSelectedAction => ({
  type: ActionTypes.SetSectionSelected,
  payload: folderId,
});

export const setSectionItemSelected = (folderId: number, itemId: number): SetSectionItemSelectedAction => ({
  type: ActionTypes.SetSectionItemSelected,
  payload: {
    folderId,
    itemId,
  },
});

export function loadSections(): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const query = getDashboardQuery(getStore().manageDashboards);
    const response = await getSearchSrv().search(query);
    dispatch(sectionsLoaded(response));
  };
}

export function loadSectionItems(sectionId: number): ThunkResult<void> {
  return async dispatch => {
    const query = {
      folderIds: [sectionId],
    };

    const items = await getBackendSrv().search(query);
    dispatch(sectionItemsLoaded(items, sectionId));
  };
}

export function updateSearchQuery(query: string): ThunkResult<void> {
  return async dispatch => {
    dispatch(setDashboardSearchQuery(query));
    dispatch(loadSections());
  };
}
