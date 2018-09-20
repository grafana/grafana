import _ from 'lodash';
import { DashboardSection, DashboardSectionItem, StoreState } from 'app/types';
import { ThunkAction } from 'redux-thunk';
import { getSearchSrv } from '../../../core/services/search_srv';
import { getDashboardQuery } from './selectors';
import { getBackendSrv } from '../../../core/services/backend_srv';

export enum ActionTypes {
  LoadSections = 'SECTIONS_LOADED',
  SetDashboardSearchQuery = 'SET_DASHBOARD_SEARCH_QUERY',
  RemoveTag = 'REMOVE_TAG',
  ClearFilters = 'CLEAR_FILTERS',
  LoadSectionItems = 'LOAD_SECTIONS_ITEMS',
  CollapseSection = 'COLLAPSE_SECTION',
  SetSectionItemSelected = 'SET_ITEM_SELECTED',
  SetSectionSelected = 'SET_SECTION_SELECTED',
  SetAllSectionsAndItemsSelected = 'SET_ALL_SECTIONS_AND_ITEMS_SELECTED',
  LoadDashboardTags = 'LOAD_DASHBOARD_TAGS',
  AddTagFilter = 'ADD_TAG_FILTER',
  SetStarredFilter = 'SET_STARRED_FILTER',
}

interface LoadSectionsAction {
  type: ActionTypes.LoadSections;
  payload: any[];
}

interface SetSearchDashboardSearchQueryAction {
  type: ActionTypes.SetDashboardSearchQuery;
  payload: string;
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
    state: boolean;
  };
}

interface SetAllSectionsAndItemsSelectedAction {
  type: ActionTypes.SetAllSectionsAndItemsSelected;
  payload: boolean;
}

interface LoadDashboardTagsAction {
  type: ActionTypes.LoadDashboardTags;
  payload: any[];
}

interface AddTagFilterAction {
  type: ActionTypes.AddTagFilter;
  payload: string;
}

interface AddStarredFilterAction {
  type: ActionTypes.SetStarredFilter;
  payload: boolean;
}

export type Action =
  | LoadSectionsAction
  | SetSearchDashboardSearchQueryAction
  | RemoveTagAction
  | ClearFiltersAction
  | LoadSectionItemsAction
  | CollapseSectionAction
  | SetSectionSelectedAction
  | SetSectionItemSelectedAction
  | SetAllSectionsAndItemsSelectedAction
  | LoadDashboardTagsAction
  | AddTagFilterAction
  | AddStarredFilterAction;

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

const dashboardTagsLoaded = (tags: any[]): LoadDashboardTagsAction => ({
  type: ActionTypes.LoadDashboardTags,
  payload: tags,
});

const tagFilterAdded = (tag: string): AddTagFilterAction => ({
  type: ActionTypes.AddTagFilter,
  payload: tag,
});

const setStarredFilter = (state: boolean): AddStarredFilterAction => ({
  type: ActionTypes.SetStarredFilter,
  payload: state,
});

export const tagFilterRemoved = (tag: string): RemoveTagAction => ({
  type: ActionTypes.RemoveTag,
  payload: tag,
});

const filtersCleared = (): ClearFiltersAction => ({
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

export const setSectionItemSelected = (item: DashboardSectionItem): SetSectionItemSelectedAction => ({
  type: ActionTypes.SetSectionItemSelected,
  payload: {
    folderId: item.folderId,
    itemId: item.id,
    state: !item.checked,
  },
});

export const setSectionsAndItemsSelected = (state: boolean): SetAllSectionsAndItemsSelectedAction => ({
  type: ActionTypes.SetAllSectionsAndItemsSelected,
  payload: state,
});

export function loadSections(): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const query = getDashboardQuery(getStore().manageDashboards);
    const response = await getSearchSrv().search(query);
    dispatch(sectionsLoaded(response));

    const tags = await getSearchSrv().getDashboardTags();
    dispatch(dashboardTagsLoaded(tags));
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
    dispatch(debouncedLoadSections);
  };
}

export function addTagFilter(tag: string): ThunkResult<void> {
  return dispatch => {
    dispatch(tagFilterAdded(tag));
    dispatch(loadSections());
  };
}

export function removeTagFilter(tag: string): ThunkResult<void> {
  return dispatch => {
    dispatch(tagFilterRemoved(tag));
    dispatch(loadSections());
  };
}

export function toggleStarredFilter(state: boolean): ThunkResult<void> {
  return dispatch => {
    dispatch(setStarredFilter(state));
    dispatch(loadSections());
  };
}

export function clearFilters(): ThunkResult<void> {
  return dispatch => {
    dispatch(filtersCleared());
    dispatch(loadSections());
  };
}

const debouncedLoadSections = _.debounce(loadSections(), 500);
