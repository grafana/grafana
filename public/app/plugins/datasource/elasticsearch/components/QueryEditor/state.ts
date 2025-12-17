import { Action, createAction } from '@reduxjs/toolkit';

import { ElasticsearchDataQuery } from '../../dataquery.gen';
import { QueryType } from '../../types';

/**
 * When the `initQuery` Action is dispatched, the query gets populated with default values where values are not present.
 * This means it won't override any existing value in place, but just ensure the query is in a "runnable" state.
 */
export const initQuery = createAction<QueryType | undefined>('init');

export const changeQuery = createAction<ElasticsearchDataQuery['query']>('change_query');

export const changeRawDSLQuery = createAction<ElasticsearchDataQuery['rawDSLQuery']>('change_raw_dsl_query');

export const changeAliasPattern = createAction<ElasticsearchDataQuery['alias']>('change_alias_pattern');

export const changeEditorType = createAction<ElasticsearchDataQuery['editorType']>('change_editor_type');

export const changeEditorTypeAndResetQuery = createAction<ElasticsearchDataQuery['editorType']>(
  'change_editor_type_and_reset_query'
);

export const queryReducer = (prevQuery: ElasticsearchDataQuery['query'], action: Action) => {
  if (changeQuery.match(action)) {
    return action.payload;
  }

  if (changeEditorTypeAndResetQuery.match(action)) {
    return '';
  }

  if (initQuery.match(action)) {
    return prevQuery || '';
  }

  return prevQuery;
};

export const rawDSLQueryReducer = (prevRawDSLQuery: ElasticsearchDataQuery['rawDSLQuery'], action: Action) => {
  if (changeRawDSLQuery.match(action)) {
    return action.payload;
  }

  if (changeEditorTypeAndResetQuery.match(action)) {
    return '';
  }

  if (initQuery.match(action)) {
    return prevRawDSLQuery || '';
  }

  return prevRawDSLQuery;
};

export const aliasPatternReducer = (prevAliasPattern: ElasticsearchDataQuery['alias'], action: Action) => {
  if (changeAliasPattern.match(action)) {
    return action.payload;
  }

  if (initQuery.match(action)) {
    return prevAliasPattern || '';
  }

  return prevAliasPattern;
};

export const editorTypeReducer = (prevEditorType: ElasticsearchDataQuery['editorType'], action: Action) => {
  if (changeEditorType.match(action)) {
    return action.payload;
  }

  if (changeEditorTypeAndResetQuery.match(action)) {
    return action.payload;
  }

  if (initQuery.match(action)) {
    return prevEditorType || 'builder';
  }

  return prevEditorType;
};
