import { AnyAction, PayloadAction } from '@reduxjs/toolkit';

import { VariableType } from '../variable';
import {
  addVariable,
  variableActions,
  variableEditorMounted,
  variableEditorUnMounted,
  VariablePayload,
} from './actions';
import { variableAdapters } from '../adapters';
import { initialVariableEditorState, VariableState } from './types';

export interface TemplatingState {
  variables: VariableState[];
}

export const initialState: TemplatingState = {
  variables: [],
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

  if (addVariable.match(action)) {
    return {
      ...state,
      variables: [...state.variables, reducer(undefined, action)],
    };
  }

  if (variableEditorMounted.match(action)) {
    return {
      ...state,
      variables: state.variables.map(variableState => {
        if (action.payload.uuid !== variableState.variable.uuid) {
          return variableState;
        }

        return {
          ...variableState,
          editor: {
            ...initialVariableEditorState,
            name: variableState.variable.name,
            type: variableState.variable.type,
          },
        };
      }),
    };
  }

  if (variableEditorUnMounted.match(action)) {
    return {
      ...state,
      variables: state.variables.map(variableState => {
        if (action.payload.uuid !== variableState.variable.uuid) {
          return variableState;
        }

        return {
          ...variableState,
          editor: initialVariableEditorState,
        };
      }),
    };
  }

  return {
    ...state,
    variables: state.variables.map(variableState => {
      if (action.payload.uuid !== variableState.variable.uuid) {
        return variableState;
      }

      return {
        ...variableState,
        ...reducer(variableState, action),
      };
    }),
  };
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
  return updateTemplatingState(variableAction.payload.type, state, variableAction);
};

export default {
  templating: templatingReducer,
};
