import { Reducer } from 'redux';
import { PayloadAction } from '@reduxjs/toolkit';

import { VariableState } from './queryVariableReducer';
import { VariableType } from '../variable';
import { addVariable, variableActions, VariablePayload } from './actions';

export const variableStateReducerFactory = <State extends VariableState = VariableState>(
  type: VariableType,
  reducer: Reducer<State>
) => (state: State[] = [], action: PayloadAction<VariablePayload<any>>): State[] => {
  if (action.payload.id.type !== type) {
    return state;
  }

  if (addVariable.match(action)) {
    const variable = reducer(undefined, action);
    return [...state, variable];
  }

  const actionCreators = variableActions.filter(actionCreator => actionCreator.match(action));
  if (actionCreators.length > 0) {
    const instanceIndex = state.findIndex(child => child.variable.name === action.payload.id.name);
    const instanceState = state[instanceIndex];
    return state.map((v, index) => {
      if (index !== instanceIndex) {
        return v;
      }

      return {
        ...v,
        ...reducer(instanceState, action),
      };
    });
  }

  return state;
};
