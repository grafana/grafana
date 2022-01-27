import { AnyAction } from 'redux';
import { createAction, PayloadAction } from '@reduxjs/toolkit';
import { getTemplatingReducers, TemplatingState } from './reducers';
import { variablesInitTransaction } from './transactionReducer';
import { toStateKey } from '../utils';

export interface DashboardVariablesState {
  lastUid?: string;
  slices: Record<string, TemplatingState>;
}

export const initialDashboardVariablesState: DashboardVariablesState = { slices: {} };

export interface UidAction {
  uid: string;
  action: PayloadAction<any>;
}

const uidAction = createAction<UidAction>('templating/uidAction');

export function toUidAction(uid: string, action: PayloadAction<any>): PayloadAction<UidAction> {
  const stringUid = toStateKey(uid);
  return uidAction({ uid: stringUid, action });
}

export function dashboardVariablesReducer(
  state = initialDashboardVariablesState,
  outerAction: AnyAction
): DashboardVariablesState {
  if (uidAction.match(outerAction)) {
    const { uid, action } = outerAction.payload;
    const stringUid = toStateKey(uid);
    const lastUid = variablesInitTransaction.match(action) ? stringUid : state.lastUid;
    const templatingReducers = getTemplatingReducers();
    const prevSliceState = state.slices[stringUid];
    const nextSliceState = templatingReducers(prevSliceState, action);

    return {
      ...state,
      lastUid,
      slices: {
        ...state.slices,
        [stringUid]: nextSliceState,
      },
    };
  }

  return state;
}

export default {
  dashboardVariables: dashboardVariablesReducer,
};
