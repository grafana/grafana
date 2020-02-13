import { PayloadAction } from '@reduxjs/toolkit';
import { VariablePayload } from './actions';
import { VariableState } from './types';
import { variableAdapters } from '../adapters';

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
  if (action?.payload?.type) {
    return variableAdapters.get(action.payload.type).reducer(state, action);
  }

  return state;
};

export default {
  templating: templatingReducer,
};
