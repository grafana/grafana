import { AnyAction } from '@reduxjs/toolkit';

import { QueryVariableState } from './queryVariablesReducer';
import { VariableType } from '../variable';
import {
  addVariable,
  removeInitLock,
  resolveInitLock,
  setCurrentVariableValue,
  setInitLock,
  updateVariableOptions,
  updateVariableTags,
} from './actions';
import { variableAdapter } from '../adapters';

export interface TemplatingState extends Record<VariableType, any> {
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

export const updateChildState = (type: VariableType, state: TemplatingState, action: AnyAction) => {
  const reducer = variableAdapter[type].getReducer();
  if (!reducer) {
    throw new Error(`Reducer for type ${type} could not be found.`);
  }
  return { ...state, [type]: reducer(state[type], action) };
};

// I stumbled upon the error described here https://github.com/immerjs/immer/issues/430
// So reverting to a "normal" reducer
export const templatingReducer = (state: TemplatingState = initialState, action: AnyAction): TemplatingState => {
  if (addVariable.match(action)) {
    return updateChildState(action.payload.model.type, state, action);
  }

  if (updateVariableOptions.match(action)) {
    return updateChildState(action.payload.variable.type, state, action);
  }

  if (updateVariableTags.match(action)) {
    return updateChildState(action.payload.variable.type, state, action);
  }

  if (setCurrentVariableValue.match(action)) {
    return updateChildState(action.payload.variable.type, state, action);
  }

  if (setInitLock.match(action)) {
    return updateChildState(action.payload.type, state, action);
  }

  if (resolveInitLock.match(action)) {
    return updateChildState(action.payload.type, state, action);
  }

  if (removeInitLock.match(action)) {
    return updateChildState(action.payload.type, state, action);
  }

  return state;
};

export default {
  templating: templatingReducer,
};
