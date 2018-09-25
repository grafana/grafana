import { ApiKeysState } from 'app/types';
import { Action, ActionTypes } from './actions';

export const initialApiKeysState: ApiKeysState = { keys: [] };

export const apiKeysReducer = (state = initialApiKeysState, action: Action): ApiKeysState => {
  switch (action.type) {
    case ActionTypes.LoadApiKeys:
      return { ...state, keys: action.payload };
  }
  return state;
};

export default {
  apiKeys: apiKeysReducer,
};
