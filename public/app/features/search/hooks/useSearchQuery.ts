import { FormEvent, useReducer } from 'react';
import { SelectableValue } from '@grafana/data';
import { defaultQuery, queryReducer } from '../reducers/searchQueryReducer';
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
import { hasFilters } from '../utils';

export const useSearchQuery = (queryParams: Partial<DashboardQuery>, updateLocation?: (args: any) => {}) => {
  const updateLocationQuery = (query: any) => updateLocation({ query, partial: true });
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
  };

  const onClearFilters = () => {
    dispatch({ type: CLEAR_FILTERS });
    updateLocationQuery(null);
  };

  const onStarredFilterChange = (e: FormEvent<HTMLInputElement>) => {
    dispatch({ type: TOGGLE_STARRED, payload: (e.target as HTMLInputElement).checked });
  };

  const onSortChange = (sort: SelectableValue | null) => {
    dispatch({ type: TOGGLE_SORT, payload: sort });
    updateLocationQuery({ sort: sort.value });
  };

  const onLayoutChange = (layout: SearchLayout) => {
    dispatch({ type: LAYOUT_CHANGE, payload: layout });
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
