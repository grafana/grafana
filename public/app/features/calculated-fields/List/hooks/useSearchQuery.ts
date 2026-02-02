import { useReducer } from 'react';

import { SelectableValue } from '@grafana/data';

import { SearchQuery, SearchLayout } from '../../types';
import { hasFilters } from '../../utils';
import {
  LAYOUT_CHANGE,
  QUERY_CHANGE,
  TOGGLE_SORT,
  FILTER_TYPE,
  DS_INSTANCE_URL,
  FIELD_ERR,
} from '../reducers/actionTypes';
import { defaultQuery, queryReducer } from '../reducers/searchQueryReducer';

export const useSearchQuery = (queryParams: Partial<SearchQuery>) => {
  const initialState = { ...defaultQuery, ...queryParams };
  const [query, dispatch] = useReducer(queryReducer, initialState);

  const onQueryChange = (query: string) => {
    dispatch({ type: QUERY_CHANGE, payload: query });
  };

  const onSortChange = (sort: SelectableValue | null) => {
    dispatch({ type: TOGGLE_SORT, payload: sort });
  };

  const onLayoutChange = (layout: SearchLayout) => {
    dispatch({ type: LAYOUT_CHANGE, payload: layout });
  };

  const onFilterTypeChange = (type: SelectableValue | null) => {
    dispatch({ type: FILTER_TYPE, payload: type?.value });
  };

  const onDSInstanceUrlChange = (url: string) => {
    dispatch({ type: DS_INSTANCE_URL, payload: url });
  };

  const onErrChange = (errMsg: string) => {
    dispatch({ type: FIELD_ERR, payload: errMsg });
  };
  return {
    query,
    hasFilters: hasFilters(query),
    onQueryChange,
    onSortChange,
    onLayoutChange,
    onFilterTypeChange,
    onDSInstanceUrlChange,
    onErrChange,
  };
};
