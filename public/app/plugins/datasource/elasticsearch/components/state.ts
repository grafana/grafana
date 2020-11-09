import { Action } from '../hooks/useStatelessReducer';

const CHANGE_QUERY = 'change_query';
const CHANGE_ALIAS_PATTERN = 'change_alias_pattern';

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

export const queryReducer = (prevQuery: string, action: ChangeQueryAction) => {
  switch (action.type) {
    case CHANGE_QUERY:
      return action.payload.query;
    default:
      return prevQuery;
  }
};

export const aliasPatternReducer = (prevAliasPattern: string, action: ChangeAliasPatternAction) => {
  switch (action.type) {
    case CHANGE_ALIAS_PATTERN:
      return action.payload.aliasPattern;
    default:
      return prevAliasPattern;
  }
};
