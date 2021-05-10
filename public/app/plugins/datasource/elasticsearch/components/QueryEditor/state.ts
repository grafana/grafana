import { Action } from '../../hooks/useStatelessReducer';
import { ElasticsearchQuery } from '../../types';

export const INIT = 'init';
const CHANGE_QUERY = 'change_query';
const CHANGE_ALIAS_PATTERN = 'change_alias_pattern';
const CHANGE_INDEX_PATTERN_OVERRIDE = 'change_index_pattern_override';

export interface InitAction extends Action<typeof INIT> {}

interface ChangeQueryAction extends Action<typeof CHANGE_QUERY> {
  payload: {
    query: string;
  };
}

interface ChangeAliasPatternAction extends Action<typeof CHANGE_ALIAS_PATTERN> {
  payload: {
    aliasPattern: string;
  };
}

interface ChangeIndexPatternOverrideAction extends Action<typeof CHANGE_INDEX_PATTERN_OVERRIDE> {
  payload: {
    indexPatternOverride: string;
  };
}

/**
 * When the `initQuery` Action is dispatched, the query gets populated with default values where values are not present.
 * This means it won't override any existing value in place, but just ensure the query is in a "runnable" state.
 */
export const initQuery = (): InitAction => ({ type: INIT });

export const changeQuery = (query: string): ChangeQueryAction => ({
  type: CHANGE_QUERY,
  payload: {
    query,
  },
});

export const changeAliasPattern = (aliasPattern: string): ChangeAliasPatternAction => ({
  type: CHANGE_ALIAS_PATTERN,
  payload: {
    aliasPattern,
  },
});

export const changeIndexPatternOverride = (indexPatternOverride: string): ChangeIndexPatternOverrideAction => ({
  type: CHANGE_INDEX_PATTERN_OVERRIDE,
  payload: {
    indexPatternOverride,
  },
});

export const queryReducer = (prevQuery: string, action: ChangeQueryAction | InitAction) => {
  switch (action.type) {
    case CHANGE_QUERY:
      return action.payload.query;

    case INIT:
      return prevQuery || '';

    default:
      return prevQuery;
  }
};

export const aliasPatternReducer = (
  prevAliasPattern: ElasticsearchQuery['alias'],
  action: ChangeAliasPatternAction | InitAction
) => {
  switch (action.type) {
    case CHANGE_ALIAS_PATTERN:
      return action.payload.aliasPattern;

    case INIT:
      return prevAliasPattern || '';

    default:
      return prevAliasPattern;
  }
};

export const indexPatternOverrideReducer = (
  prevIndexPatternOverride: string,
  action: ChangeIndexPatternOverrideAction | InitAction
) => {
  switch (action.type) {
    case CHANGE_INDEX_PATTERN_OVERRIDE:
      return action.payload.indexPatternOverride;

    case INIT:
      return '';

    default:
      return prevIndexPatternOverride;
  }
};
