import { FormEvent, useReducer } from 'react';
import { SelectableValue } from '@grafana/data';
import { defaultQuery, defaultQueryParams, queryReducer } from '../reducers/searchQueryReducer';
import {
  ADD_TAG,
  CLEAR_FILTERS,
  LAYOUT_CHANGE,
  QUERY_CHANGE,
  SET_TAGS,
  TOGGLE_SORT,
  TOGGLE_STARRED,
} from '../reducers/actionTypes';
import { DashboardQuery, SearchLayout } from '../types';
import { hasFilters, parseRouteParams } from '../utils';
import { locationService } from '@grafana/runtime';

export const useSearchQuery = (defaults: Partial<DashboardQuery>) => {
  const queryParams = parseRouteParams(locationService.getSearchObject());
  const initialState = { ...defaultQuery, ...defaults, ...queryParams };
  const [query, dispatch] = useReducer(queryReducer, initialState);

  const onQueryChange = (query: string) => {
    dispatch({ type: QUERY_CHANGE, payload: query });
    locationService.partial({ query });
  };

  const onTagFilterChange = (tags: string[]) => {
    dispatch({ type: SET_TAGS, payload: tags });
    locationService.partial({ tag: tags });
  };

  const onTagAdd = (tag: string) => {
    dispatch({ type: ADD_TAG, payload: tag });
    locationService.partial({ tag: [...query.tag, tag] });
  };

  const onClearFilters = () => {
    dispatch({ type: CLEAR_FILTERS });
    locationService.partial(defaultQueryParams);
  };

  const onStarredFilterChange = (e: FormEvent<HTMLInputElement>) => {
    const starred = (e.target as HTMLInputElement).checked;
    dispatch({ type: TOGGLE_STARRED, payload: starred });
    locationService.partial({ starred: starred || null });
  };

  const onSortChange = (sort: SelectableValue | null) => {
    dispatch({ type: TOGGLE_SORT, payload: sort });
    locationService.partial({ sort: sort?.value, layout: SearchLayout.List });
  };

  const onLayoutChange = (layout: SearchLayout) => {
    dispatch({ type: LAYOUT_CHANGE, payload: layout });
    if (layout === SearchLayout.Folders) {
      locationService.partial({ layout, sort: null });
      return;
    }
    locationService.partial({ layout });
  };

  return {
    query,
    hasFilters: hasFilters(query),
    onQueryChange,
    onClearFilters,
    onTagFilterChange,
    onStarredFilterChange,
    onTagAdd,
    onSortChange,
    onLayoutChange,
  };
};
