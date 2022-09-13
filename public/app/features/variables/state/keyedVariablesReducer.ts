import { PayloadAction } from '@reduxjs/toolkit';
import { AnyAction } from 'redux';

import { toStateKey } from '../utils';

import { getTemplatingReducers, TemplatingState } from './reducers';
import { variablesInitTransaction } from './transactionReducer';

export interface KeyedVariablesState {
  lastKey?: string;
  keys: Record<string, TemplatingState>;
}

export const initialKeyedVariablesState: KeyedVariablesState = { keys: {} };

export interface KeyedAction {
  key: string;
  action: PayloadAction<any>;
}

const keyedAction = (payload: KeyedAction) => ({
  type: `templating/keyed/${payload.action.type.replace(/^templating\//, '')}`,
  payload,
});

export function toKeyedAction(key: string, action: PayloadAction<any>): PayloadAction<KeyedAction> {
  const keyAsString = toStateKey(key);
  return keyedAction({ key: keyAsString, action });
}

const isKeyedAction = (action: AnyAction): action is PayloadAction<KeyedAction> => {
  return (
    typeof action.type === 'string' &&
    action.type.startsWith('templating/keyed') &&
    'payload' in action &&
    typeof action.payload.key === 'string'
  );
};

export function keyedVariablesReducer(state = initialKeyedVariablesState, outerAction: AnyAction): KeyedVariablesState {
  if (isKeyedAction(outerAction)) {
    const { key, action } = outerAction.payload;
    const stringKey = toStateKey(key);
    const lastKey = variablesInitTransaction.match(action) ? stringKey : state.lastKey;
    const templatingReducers = getTemplatingReducers();
    const prevKeyState = state.keys[stringKey];
    const nextKeyState = templatingReducers(prevKeyState, action);

    return {
      ...state,
      lastKey,
      keys: {
        ...state.keys,
        [stringKey]: nextKeyState,
      },
    };
  }

  return state;
}

export default {
  templating: keyedVariablesReducer,
};
