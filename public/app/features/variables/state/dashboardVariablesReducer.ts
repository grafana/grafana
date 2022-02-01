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

export interface UidAction {
  key: string;
  action: PayloadAction<any>;
}

const uidAction = createAction<UidAction>('templating/uidAction');

export function toUidAction(key: string, action: PayloadAction<any>): PayloadAction<UidAction> {
  const stringUid = toStateKey(key);
  return uidAction({ key: stringUid, action });
}

export function dashboardVariablesReducer(
  state = initialDashboardVariablesState,
  outerAction: AnyAction
): DashboardVariablesState {
  if (uidAction.match(outerAction)) {
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
