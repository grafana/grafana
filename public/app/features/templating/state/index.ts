import { AnyAction, PayloadAction } from '@reduxjs/toolkit';

import { QueryVariableState, VariableState } from './queryVariableReducer';
import { VariableType } from '../variable';
import { variableActions, VariablePayload } from './actions';
import { variableAdapters } from '../adapters';

export interface TemplatingState extends Record<VariableType, Array<VariableState<any, any>>> {
  query: QueryVariableState[];
}

export const initialState: TemplatingState = {
  query: [],
  adhoc: [],
  interval: [],
  custom: [],
  datasource: [],
  constant: [],
  textbox: [],
};

export const updateTemplatingState = (
  type: VariableType,
  state: TemplatingState,
  action: PayloadAction<VariablePayload<any>>
) => {
  const reducer = variableAdapters.get(type).reducer;
  if (!reducer) {
    throw new Error(`Reducer for type ${type} could not be found.`);
  }
  return { ...state, [type]: reducer(state[type], action) };
};

// I stumbled upon the error described here https://github.com/immerjs/immer/issues/430
// So reverting to a "normal" reducer
export const templatingReducer = (state: TemplatingState = initialState, action: AnyAction): TemplatingState => {
  // filter out all action creators that are not registered as variable action creator
  const actionCreators = variableActions.filter(actionCreator => actionCreator.match(action));
  if (actionCreators.length === 0) {
    return state;
  }

  // now we're sure that this action is meant for variables so pass it to correct reducer
  const variableAction: PayloadAction<VariablePayload<any>> = action as PayloadAction<VariablePayload<any>>;
  const { type } = variableAction.payload.id;
  return updateTemplatingState(type, state, variableAction);
};

export default {
  templating: templatingReducer,
};
