import { PayloadAction } from '@reduxjs/toolkit';
import { cleanUpDashboard } from '../../dashboard/state/reducers';
import { variableAdapters } from '../adapters';
import { sharedReducer } from './sharedReducer';
import { VariableModel } from '../../templating/types';
import { VariablePayload } from './types';

export interface VariablesState extends Record<string, VariableModel> {}

export const initialVariablesState: VariablesState = {};

export const variablesReducer = (
  state: VariablesState = initialVariablesState,
  action: PayloadAction<VariablePayload>
): VariablesState => {
  if (cleanUpDashboard.match(action)) {
    const globalVariables = Object.values(state).filter(v => v.global);
    if (!globalVariables) {
      return initialVariablesState;
    }

    const variables = globalVariables.reduce((allVariables, state) => {
      allVariables[state.id!] = state;
      return allVariables;
    }, {} as Record<string, VariableModel>);

    return variables;
  }

  if (action?.payload?.type && variableAdapters.getIfExists(action?.payload?.type)) {
    // Now that we know we are dealing with a payload that is addressed for an adapted variable let's reduce state:
    // Firstly call the sharedTemplatingReducer that handles all shared actions between variable types
    // Secondly call the specific variable type's reducer
    return variableAdapters.get(action.payload.type).reducer(sharedReducer(state, action), action);
  }

  return state;
};
