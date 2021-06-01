import { FormEvent, useReducer } from 'react';
import { debounce } from 'lodash';
import { SelectableValue } from '@grafana/data';
import { locationService } from '@grafana/runtime';
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

const updateLocation = debounce((query) => locationService.partial(query), 300);

export const useSearchQuery = (defaults: Partial<DashboardQuery>) => {
  const queryParams = parseRouteParams(locationService.getSearchObject());
  const initialState = { ...defaultQuery, ...defaults, ...queryParams };
  const [query, dispatch] = useReducer(queryReducer, initialState);

  const onQueryChange = (query: string) => {
    dispatch({ type: QUERY_CHANGE, payload: query });
    updateLocation({ query });
  };

  const onTagFilterChange = (tags: string[]) => {
    dispatch({ type: SET_TAGS, payload: tags });
    updateLocation({ tag: tags });
  };

  const onTagAdd = (tag: string) => {
    dispatch({ type: ADD_TAG, payload: tag });
    updateLocation({ tag: [...query.tag, tag] });
  };

  const onClearFilters = () => {
    dispatch({ type: CLEAR_FILTERS });
    updateLocation(defaultQueryParams);
  };

  const onStarredFilterChange = (e: FormEvent<HTMLInputElement>) => {
    const starred = (e.target as HTMLInputElement).checked;
    dispatch({ type: TOGGLE_STARRED, payload: starred });
    updateLocation({ starred: starred || null });
  };

  const onSortChange = (sort: SelectableValue | null) => {
    dispatch({ type: TOGGLE_SORT, payload: sort });
    updateLocation({ sort: sort?.value, layout: SearchLayout.List });
  };

  const onLayoutChange = (layout: SearchLayout) => {
    dispatch({ type: LAYOUT_CHANGE, payload: layout });
    if (layout === SearchLayout.Folders) {
      updateLocation({ layout, sort: null });
      return;
    }
    updateLocation({ layout });
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
