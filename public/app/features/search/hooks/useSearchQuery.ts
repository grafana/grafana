import { useReducer } from 'react';
import { SelectableValue } from '@grafana/data';
import { defaultQuery, queryReducer } from '../reducers/searchQueryReducer';
import {
  ADD_TAG,
  CLEAR_FILTERS,
  QUERY_CHANGE,
  REMOVE_STARRED,
  REMOVE_TAG,
  SET_TAGS,
  TOGGLE_SORT,
  TOGGLE_STARRED,
} from '../reducers/actionTypes';
import { DashboardQuery } from '../types';

export const useSearchQuery = (queryParams: Partial<DashboardQuery>) => {
  const initialState = { ...defaultQuery, ...queryParams };
  const [query, dispatch] = useReducer(queryReducer, initialState);

  const onQueryChange = (query: string) => {
    dispatch({ type: QUERY_CHANGE, payload: query });
  };

  const onRemoveStarred = () => {
    dispatch({ type: REMOVE_STARRED });
  };

  const onTagRemove = (tag: string) => {
    dispatch({ type: REMOVE_TAG, payload: tag });
  };

  const onTagFilterChange = (tags: string[]) => {
    dispatch({ type: SET_TAGS, payload: tags });
  };

  const onTagAdd = (tag: string) => {
    dispatch({ type: ADD_TAG, payload: tag });
  };

  const onClearFilters = () => {
    dispatch({ type: CLEAR_FILTERS });
  };

  const onStarredFilterChange = (filter: SelectableValue) => {
    dispatch({ type: TOGGLE_STARRED, payload: filter.value });
  };

  const onSortChange = (sort: SelectableValue) => {
    dispatch({ type: TOGGLE_SORT, payload: sort?.value });
  };

  const hasFilters = query.query.length > 0 || query.tag.length > 0 || query.starred;

  return {
    query,
    hasFilters,
    onQueryChange,
    onRemoveStarred,
    onTagRemove,
    onClearFilters,
    onTagFilterChange,
    onStarredFilterChange,
    onTagAdd,
    onSortChange,
  };
};
