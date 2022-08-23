import { debounce } from 'lodash';
import { FormEvent, useCallback, useReducer } from 'react';

import { SelectableValue } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { SEARCH_SELECTED_LAYOUT } from '../constants';
import {
  ADD_TAG,
  CLEAR_FILTERS,
  LAYOUT_CHANGE,
  QUERY_CHANGE,
  SET_TAGS,
  TOGGLE_SORT,
  TOGGLE_STARRED,
  DATASOURCE_CHANGE,
} from '../reducers/actionTypes';
import { defaultQuery, defaultQueryParams, queryReducer } from '../reducers/searchQueryReducer';
import { DashboardQuery, SearchLayout } from '../types';
import { hasFilters, parseRouteParams } from '../utils';

const updateLocation = debounce((query) => locationService.partial(query, true), 300);

export const useSearchQuery = (defaults: Partial<DashboardQuery>) => {
  const queryParams = parseRouteParams(locationService.getSearchObject());
  const initialState = { ...defaultQuery, ...defaults, ...queryParams };
  const selectedLayout = localStorage.getItem(SEARCH_SELECTED_LAYOUT) as SearchLayout;
  if (!queryParams.layout?.length && selectedLayout?.length) {
    initialState.layout = selectedLayout;
  }
  const [query, dispatch] = useReducer(queryReducer, initialState);

  const onQueryChange = useCallback((query: string) => {
    dispatch({ type: QUERY_CHANGE, payload: query });
    updateLocation({ query });
  }, []);

  const onTagFilterChange = useCallback((tags: string[]) => {
    dispatch({ type: SET_TAGS, payload: tags });
    updateLocation({ tag: tags });
  }, []);

  const onDatasourceChange = useCallback((datasource?: string) => {
    dispatch({ type: DATASOURCE_CHANGE, payload: datasource });
    updateLocation({ datasource });
  }, []);

  const onTagAdd = useCallback(
    (tag: string) => {
      dispatch({ type: ADD_TAG, payload: tag });
      updateLocation({ tag: [...query.tag, tag] });
    },
    [query.tag]
  );

  const onClearFilters = useCallback(() => {
    dispatch({ type: CLEAR_FILTERS });
    updateLocation(defaultQueryParams);
  }, []);

  const onStarredFilterChange = useCallback((e: FormEvent<HTMLInputElement>) => {
    const starred = (e.target as HTMLInputElement).checked;
    dispatch({ type: TOGGLE_STARRED, payload: starred });
    updateLocation({ starred: starred || null });
  }, []);

  const onClearStarred = useCallback(() => {
    dispatch({ type: TOGGLE_STARRED, payload: false });
    updateLocation({ starred: null });
  }, []);

  const onSortChange = useCallback((sort: SelectableValue | null) => {
    dispatch({ type: TOGGLE_SORT, payload: sort });
    updateLocation({ sort: sort?.value, layout: SearchLayout.List });
  }, []);

  const onLayoutChange = useCallback((layout: SearchLayout) => {
    dispatch({ type: LAYOUT_CHANGE, payload: layout });
    if (layout === SearchLayout.Folders) {
      updateLocation({ layout, sort: null });
      return;
    }
    updateLocation({ layout });
  }, []);

  return {
    query,
    hasFilters: hasFilters(query),
    onQueryChange,
    onClearFilters,
    onTagFilterChange,
    onStarredFilterChange,
    onClearStarred,
    onTagAdd,
    onSortChange,
    onLayoutChange,
    onDatasourceChange,
  };
};
