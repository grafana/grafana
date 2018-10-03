import { ApiKeysState } from 'app/types';
import { Action, ActionTypes } from './actions';

export const initialApiKeysState: ApiKeysState = {
  keys: [],
  searchQuery: '',
};

export const apiKeysReducer = (state = initialApiKeysState, action: Action): ApiKeysState => {
  switch (action.type) {
    case ActionTypes.LoadApiKeys:
      return { ...state, keys: action.payload };
    case ActionTypes.SetApiKeysSearchQuery:
      return { ...state, searchQuery: action.payload };
  }
  return state;
};

export default {
  apiKeys: apiKeysReducer,
};
