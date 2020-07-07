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
import { DashboardQuery, RouteParams, SearchLayout } from '../types';
import { hasFilters } from '../utils';

export const useSearchQuery = (queryParams: Partial<DashboardQuery>, updateLocation = (args: any) => {}) => {
  const updateLocationQuery = (query: RouteParams) => updateLocation({ query, partial: true });
  const initialState = { ...defaultQuery, ...queryParams };
  const [query, dispatch] = useReducer(queryReducer, initialState);

  const onQueryChange = (query: string) => {
    dispatch({ type: QUERY_CHANGE, payload: query });
    updateLocationQuery({ query });
  };

  const onTagFilterChange = (tags: string[]) => {
    dispatch({ type: SET_TAGS, payload: tags });
    updateLocationQuery({ tag: tags });
  };

  const onTagAdd = (tag: string) => {
    dispatch({ type: ADD_TAG, payload: tag });
    updateLocationQuery({ tag: [...query.tag, tag] });
  };

  const onClearFilters = () => {
    dispatch({ type: CLEAR_FILTERS });
    updateLocationQuery(defaultQueryParams);
  };

  const onStarredFilterChange = (e: FormEvent<HTMLInputElement>) => {
    const starred = (e.target as HTMLInputElement).checked;
    dispatch({ type: TOGGLE_STARRED, payload: starred });
    updateLocationQuery({ starred: starred || null });
  };

  const onSortChange = (sort: SelectableValue | null) => {
    dispatch({ type: TOGGLE_SORT, payload: sort });
    updateLocationQuery({ sort: sort?.value, layout: SearchLayout.List });
  };

  const onLayoutChange = (layout: SearchLayout) => {
    dispatch({ type: LAYOUT_CHANGE, payload: layout });
    updateLocationQuery({ layout });
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
