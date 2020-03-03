import { VariableState } from './types';
import { PayloadAction } from '@reduxjs/toolkit';
import { VariablePayload } from './actions';
import { cleanUpDashboard } from '../../dashboard/state/reducers';
import { variableAdapters } from '../adapters';
import { sharedReducer } from './sharedReducer';

export interface VariablesState {
  variables: Record<string, VariableState>;
}

export const initialVariablesState: VariablesState = {
  variables: {},
};

export const variablesReducer = (
  state: VariablesState = initialVariablesState,
  action: PayloadAction<VariablePayload>
): VariablesState => {
  if (cleanUpDashboard.match(action)) {
    const globalVariables = Object.values(state.variables).filter(v => v.variable.global);
    if (!globalVariables) {
      return initialVariablesState;
    }

    const variables = globalVariables.reduce((allVariables, state) => {
      allVariables[state.variable.uuid!] = state;
      return allVariables;
    }, {} as Record<string, VariableState>);

    return {
      ...state,
      variables,
    };
  }

  if (action?.payload?.type && variableAdapters.contains(action?.payload?.type)) {
    // Now that we know we are dealing with a payload that is addressed for an adapted variable let's reduce state:
    // Firstly call the sharedTemplatingReducer that handles all shared actions between variable types
    // Secondly call the specific variable type's reducer
    return variableAdapters.get(action.payload.type).reducer(sharedReducer(state, action), action);
  }

  return state;
};
