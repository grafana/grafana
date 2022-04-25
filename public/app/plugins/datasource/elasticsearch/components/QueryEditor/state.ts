import { Action, createAction } from '@reduxjs/toolkit';

import { ElasticsearchQuery } from '../../types';

/**
 * When the `initQuery` Action is dispatched, the query gets populated with default values where values are not present.
 * This means it won't override any existing value in place, but just ensure the query is in a "runnable" state.
 */
export const initQuery = createAction('init');

export const changeQuery = createAction<ElasticsearchQuery['query']>('change_query');

export const changeAliasPattern = createAction<ElasticsearchQuery['alias']>('change_alias_pattern');

export const queryReducer = (prevQuery: ElasticsearchQuery['query'], action: Action) => {
  if (changeQuery.match(action)) {
    return action.payload;
  }

  if (initQuery.match(action)) {
    return prevQuery || '';
  }

  return prevQuery;
};

export const aliasPatternReducer = (prevAliasPattern: ElasticsearchQuery['alias'], action: Action) => {
  if (changeAliasPattern.match(action)) {
    return action.payload;
  }

  if (initQuery.match(action)) {
    return prevAliasPattern || '';
  }

  return prevAliasPattern;
};
