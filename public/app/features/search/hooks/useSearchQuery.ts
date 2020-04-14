import React, { useReducer } from 'react';
import { SelectableValue } from '@grafana/data';
import { defaultQuery, queryReducer } from '../reducers/searchQueryReducer';
import {
  ADD_TAG,
  CLEAR_FILTERS,
  QUERY_CHANGE,
  REMOVE_STARRED,
  SET_TAGS,
  TOGGLE_STARRED,
} from '../reducers/actionTypes';

export const useSearchQuery = (folderId: number | undefined) => {
  const initialState = folderId ? { ...defaultQuery, folderIds: [folderId] } : defaultQuery;
  const [query, dispatch] = useReducer(queryReducer, initialState);

  const onQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.persist();
    dispatch({ type: QUERY_CHANGE, payload: event.target.value });
  };

  const onRemoveStarred = () => {
    dispatch({ type: REMOVE_STARRED });
  };
  const onTagRemove = (tag: string) => {
    dispatch({ type: REMOVE_STARRED, payload: tag });
  };
  const onClearFilters = () => {
    dispatch({ type: CLEAR_FILTERS });
  };
  const onTagFilterChange = (tags: string[]) => {
    dispatch({ type: SET_TAGS, payload: tags });
  };

  const onStarredFilterChange = (filter: SelectableValue) => {
    dispatch({ type: TOGGLE_STARRED, payload: filter.value });
  };
  const onTagAdd = (tag: string) => {
    dispatch({ type: ADD_TAG, payload: tag });
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
  };
};
