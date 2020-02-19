import { PayloadAction } from '@reduxjs/toolkit';
import { VariablePayload } from './actions';
import { VariableState } from './types';
import { variableAdapters } from '../adapters';
import { sharedTemplatingReducer } from './sharedTemplatingReducer';
import { cleanUpDashboard } from 'app/features/dashboard/state/reducers';
import { getReducer } from '../locator';

export interface TemplatingState {
  variables: Record<string, VariableState>;
}

export const initialTemplatingState: TemplatingState = {
  variables: {},
};

export const templatingReducer = (
  state: TemplatingState = initialTemplatingState,
  action: PayloadAction<VariablePayload>
): TemplatingState => {
  if (cleanUpDashboard.match(action)) {
    const globalVariables = Object.values(state.variables).filter(v => v.variable.global);
    if (!globalVariables) {
      return initialTemplatingState;
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

  if (variableAdapters.contains(action?.payload?.type)) {
    // Now that we know we are dealing with a payload that is addressed for an adapted variable let's reduce state:
    // Firstly call the sharedTemplatingReducer that handles all shared actions between variable types
    // Secondly call the specific variable type's reducer
    const reducer = getReducer(action?.payload?.type);
    return reducer(sharedTemplatingReducer(state, action), action);
  }

  return state;
};

export default {
  templating: templatingReducer,
};
