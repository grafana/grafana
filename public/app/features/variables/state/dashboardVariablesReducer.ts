import { AnyAction } from 'redux';
import { createAction, PayloadAction } from '@reduxjs/toolkit';
import { getTemplatingReducers, TemplatingState } from './reducers';
import { variablesInitTransaction } from './transactionReducer';
import { toStateKey } from '../utils';

export interface DashboardVariablesState {
  lastKey?: string;
  keys: Record<string, TemplatingState>;
}

export const initialDashboardVariablesState: DashboardVariablesState = { keys: {} };

export interface KeyedAction {
  key: string;
  action: PayloadAction<any>;
}

const keyedAction = createAction<KeyedAction>('templating/keyedAction');

export function toKeyedAction(key: string, action: PayloadAction<any>): PayloadAction<KeyedAction> {
  const keyAsString = toStateKey(key);
  return keyedAction({ key: keyAsString, action });
}

export function dashboardVariablesReducer(
  state = initialDashboardVariablesState,
  outerAction: AnyAction
): DashboardVariablesState {
  if (keyedAction.match(outerAction)) {
    const { key, action } = outerAction.payload;
    const stringKey = toStateKey(key);
    const lastKey = variablesInitTransaction.match(action) ? stringKey : state.lastKey;
    const templatingReducers = getTemplatingReducers();
    const prevSliceState = state.keys[stringKey];
    const nextSliceState = templatingReducers(prevSliceState, action);

    return {
      ...state,
      lastKey,
      keys: {
        ...state.keys,
        [stringKey]: nextSliceState,
      },
    };
  }

  return state;
}

export default {
  dashboardVariables: dashboardVariablesReducer,
};
