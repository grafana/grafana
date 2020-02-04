import { AnyAction, PayloadAction } from '@reduxjs/toolkit';

import { VariableType } from '../variable';
import {
  addVariable,
  changeVariableHide,
  changeVariableLabel,
  removeVariable,
  updateVariableCompleted,
  updateVariableFailed,
  updateVariableStarting,
  variableActions,
  variableEditorMounted,
  variableEditorUnMounted,
  VariablePayload,
} from './actions';
import { variableAdapters } from '../adapters';
import { initialVariableEditorState, VariableState } from './types';

export interface TemplatingState {
  variables: Record<string, VariableState>;
}

export const initialState: TemplatingState = {
  variables: {},
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
      variables: {
        ...state.variables,
        [action.payload.uuid]: reducer(undefined, action),
      },
    };
  }

  if (removeVariable.match(action)) {
    delete state.variables[action.payload.uuid];
    return state;
  }

  if (variableEditorMounted.match(action)) {
    return {
      ...state,
      variables: {
        ...state.variables,
        [action.payload.uuid]: {
          ...state.variables[action.payload.uuid],
          editor: {
            ...initialVariableEditorState,
            name: state.variables[action.payload.uuid].variable.name,
            type: state.variables[action.payload.uuid].variable.type,
            dataSources: action.payload.data,
          },
        },
      },
    };
  }

  if (variableEditorUnMounted.match(action)) {
    return {
      ...state,
      variables: {
        ...state.variables,
        [action.payload.uuid]: {
          ...state.variables[action.payload.uuid],
          editor: initialVariableEditorState,
        },
      },
    };
  }

  if (changeVariableLabel.match(action)) {
    return {
      ...state,
      variables: {
        ...state.variables,
        [action.payload.uuid]: {
          ...state.variables[action.payload.uuid],
          variable: {
            ...state.variables[action.payload.uuid].variable,
            label: action.payload.data,
          },
        },
      },
    };
  }

  if (changeVariableHide.match(action)) {
    return {
      ...state,
      variables: {
        ...state.variables,
        [action.payload.uuid]: {
          ...state.variables[action.payload.uuid],
          variable: {
            ...state.variables[action.payload.uuid].variable,
            hide: action.payload.data,
          },
        },
      },
    };
  }

  if (updateVariableStarting.match(action)) {
    return {
      ...state,
      variables: {
        ...state.variables,
        [action.payload.uuid]: {
          ...state.variables[action.payload.uuid],
          editor: {
            ...initialVariableEditorState,
            ...state.variables[action.payload.uuid].editor,
          },
        },
      },
    };
  }

  if (updateVariableCompleted.match(action)) {
    return {
      ...state,
      variables: {
        ...state.variables,
        [action.payload.uuid]: {
          ...state.variables[action.payload.uuid],
          editor: {
            ...initialVariableEditorState,
            ...state.variables[action.payload.uuid].editor,
          },
        },
      },
    };
  }

  if (updateVariableFailed.match(action)) {
    return {
      ...state,
      variables: {
        ...state.variables,
        [action.payload.uuid]: {
          ...state.variables[action.payload.uuid],
          editor: {
            ...state.variables[action.payload.uuid].editor,
            isValid: false,
            errors: {
              ...state.variables[action.payload.uuid].editor.errors,
              update: action.payload.data.message,
            },
          },
        },
      },
    };
  }

  return {
    ...state,
    variables: {
      ...state.variables,
      [action.payload.uuid]: reducer(state.variables[action.payload.uuid], action),
    },
  };
};

// I stumbled upon the error described here https://github.com/immerjs/immer/issues/430
// So reverting to a "normal" reducer
export const templatingReducer = (state: TemplatingState = initialState, action: AnyAction): TemplatingState => {
  // filter out all action creators that are not registered as variable action creator
  const actionCreator = variableActions[action.type];
  if (!actionCreator) {
    return state;
  }

  // now we're sure that this action is meant for variables so pass it to correct reducer
  const variableAction: PayloadAction<VariablePayload<any>> = action as PayloadAction<VariablePayload<any>>;
  return updateTemplatingState(variableAction.payload.type, state, variableAction);
};

export default {
  templating: templatingReducer,
};
