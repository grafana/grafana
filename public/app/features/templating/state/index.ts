import cloneDeep from 'lodash/cloneDeep';
import { AnyAction, PayloadAction } from '@reduxjs/toolkit';

import { VariableModel, VariableType } from '../variable';
import {
  addVariable,
  changeVariableHide,
  changeVariableLabel,
  changeVariableOrder,
  duplicateVariable,
  newVariable,
  removeVariable,
  storeNewVariable,
  updateVariableCompleted,
  updateVariableFailed,
  updateVariableStarting,
  variableActions,
  variableEditorMounted,
  variableEditorUnMounted,
  VariablePayload,
} from './actions';
import { variableAdapters } from '../adapters';
import { emptyUuid, initialVariableEditorState, VariableState } from './types';

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
    if (!state.variables[action.payload.uuid]) {
      // this could be an unmount event from a variable that doesn't exist any longer
      return state;
    }
    const newState = {
      ...state,
      variables: {
        ...state.variables,
        [action.payload.uuid]: {
          ...state.variables[action.payload.uuid],
          editor: initialVariableEditorState,
        },
      },
    };
    if (newState.variables[emptyUuid]) {
      delete newState.variables[emptyUuid];
    }
    return newState;
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

  if (duplicateVariable.match(action)) {
    const original = cloneDeep<VariableModel>(state.variables[action.payload.uuid].variable);
    const cleanState = variableAdapters
      .get(original.type)
      .reducer((undefined as unknown) as VariableState, { type: '', payload: {} as VariablePayload });
    const uuid = action.payload.data.newUuid;
    const index = action.payload.data.variablesInAngular + Object.keys(state.variables).length;
    const name = `copy_of_${original.name}`;
    return {
      ...state,
      variables: {
        ...state.variables,
        [uuid]: {
          ...cleanState,
          variable: {
            ...original,
            uuid,
            index,
            name,
          },
        },
      },
    };
  }

  if (changeVariableOrder.match(action)) {
    const variables = Object.values(state.variables).map(s => s.variable);
    const fromVariable = variables.find(v => v.index === action.payload.data.fromIndex);
    const toVariable = variables.find(v => v.index === action.payload.data.toIndex);
    const newVariables = { ...state.variables };

    if (fromVariable) {
      const fromUuid = fromVariable.uuid ?? '';
      newVariables[fromUuid] = {
        ...newVariables[fromUuid],
        variable: {
          ...newVariables[fromUuid].variable,
          index: action.payload.data.toIndex,
        },
      };
    }

    if (toVariable) {
      const toUuid = toVariable.uuid ?? '';
      newVariables[toUuid] = {
        ...newVariables[toUuid],
        variable: {
          ...newVariables[toUuid].variable,
          index: action.payload.data.fromIndex,
        },
      };
    }

    return {
      ...state,
      variables: newVariables,
    };
  }

  if (newVariable.match(action)) {
    const newInitialState: VariableState = reducer((undefined as unknown) as VariableState, {
      type: '',
      payload: {} as VariablePayload,
    });
    const newVariableState: VariableState = {
      ...newInitialState,
      variable: {
        ...newInitialState.variable,
        index: action.payload.data.variablesInAngular + Object.keys(state.variables).length,
      },
    };
    return {
      ...state,
      variables: {
        ...state.variables,
        [emptyUuid]: newVariableState,
      },
    };
  }

  if (storeNewVariable.match(action)) {
    const uuid = action.payload.uuid ?? '';
    const newInitialState: VariableState = reducer((undefined as unknown) as VariableState, {
      type: '',
      payload: {} as VariablePayload,
    });
    const emptyVariable: VariableModel = cloneDeep<VariableModel>(state.variables[emptyUuid].variable);
    const newVariableState: VariableState = {
      ...newInitialState,
      variable: {
        ...emptyVariable,
        uuid,
      },
    };
    return {
      ...state,
      variables: {
        ...state.variables,
        [uuid]: newVariableState,
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
