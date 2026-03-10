import { Action, createAction } from '@reduxjs/toolkit';

import { ElasticsearchDataQuery } from '../../dataquery.gen';
import { QueryLanguage, QueryType } from '../../types';

import { changeMetricType } from './MetricAggregationsEditor/state/actions';

/**
 * When the `initQuery` Action is dispatched, the query gets populated with default values where values are not present.
 * This means it won't override any existing value in place, but just ensure the query is in a "runnable" state.
 */
export const initQuery = createAction<QueryType | undefined>('init');

export const changeQuery = createAction<ElasticsearchDataQuery['query']>('change_query');

export const changeQueryType = createAction<ElasticsearchDataQuery['queryType']>('change_query_type');

export const changeEsqlQuery = createAction<ElasticsearchDataQuery['esqlQuery']>('change_esql_query');

export const changeAliasPattern = createAction<ElasticsearchDataQuery['alias']>('change_alias_pattern');

export const changeEditorType = createAction<ElasticsearchDataQuery['editorType']>('change_editor_type');

export const changeEditorTypeAndResetQuery = createAction<ElasticsearchDataQuery['editorType']>(
  'change_editor_type_and_reset_query'
);

export const changeQueryLanguage = createAction<QueryLanguage>('change_query_language');

export const queryReducer = (prevQuery: ElasticsearchDataQuery['query'], action: Action) => {
  if (changeQuery.match(action)) {
    return action.payload;
  }

  if (changeEditorTypeAndResetQuery.match(action)) {
    return '';
  }

  // Clear query when switching query types (e.g., from Lucene to DSL or vice versa)
  if (changeQueryType.match(action)) {
    return '';
  }

  // Clear query when switching metric types (e.g., from logs to metrics, or to raw_data)
  if (changeMetricType.match(action)) {
    return '';
  }

  if (initQuery.match(action)) {
    return prevQuery || '';
  }

  return prevQuery;
};

export const queryTypeReducer = (prevQueryType: ElasticsearchDataQuery['queryType'], action: Action) => {
  if (changeQueryType.match(action)) {
    return action.payload;
  }

  if (changeEditorType.match(action) || changeEditorTypeAndResetQuery.match(action)) {
    // When switching editor types, set queryType accordingly:
    // - 'code' editor uses DSL queries
    // - 'builder' editor uses Lucene queries
    return action.payload === 'code' ? 'dsl' : 'lucene';
  }

  if (initQuery.match(action)) {
    return prevQueryType || 'lucene';
  }

  return prevQueryType;
};

export const esqlQueryReducer = (prevEsqlQuery: ElasticsearchDataQuery['esqlQuery'], action: Action) => {
  if (changeEsqlQuery.match(action)) {
    return action.payload;
  }

  if (changeEditorTypeAndResetQuery.match(action)) {
    return '';
  }

  if (changeMetricType.match(action)) {
    return '';
  }

  if (initQuery.match(action)) {
    return prevEsqlQuery || '';
  }

  return prevEsqlQuery;
};

export const aliasPatternReducer = (prevAliasPattern: ElasticsearchDataQuery['alias'], action: Action) => {
  if (changeAliasPattern.match(action)) {
    return action.payload;
  }

  if (changeEditorTypeAndResetQuery.match(action)) {
    return '';
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

export const queryLanguageReducer = (
  prevQueryLanguage: ElasticsearchDataQuery['queryLanguage'],
  action: Action
): ElasticsearchDataQuery['queryLanguage'] => {
  if (changeQueryLanguage.match(action)) {
    return action.payload;
  }

  if (initQuery.match(action)) {
    return prevQueryLanguage ?? 'raw_dsl';
  }

  return prevQueryLanguage;
};
