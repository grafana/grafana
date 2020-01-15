import { AnyAction, createAction } from '@reduxjs/toolkit';

import { assignModelProperties, VariableModel } from '../variable';
import { ChangeVariableType, CreateVariable, RemoveVariable, UpdateVariableProp } from './actionsTypes';
import { cleanUpDashboard } from '../../dashboard/state/actions';

const reorganizeIds = (varibles: VariableModel[]): VariableModel[] =>
  varibles.map((variable, index) => ({ ...variable, id: index }));

export interface TemplatingState {
  variables: VariableModel[];
  lastId: number;
  nextId: number;
}

export const initialState: TemplatingState = {
  variables: [],
  lastId: -1,
  nextId: 0,
};

export const createVariable = createAction<CreateVariable>('templating/createVariable');
export const updateVariableProp = createAction<UpdateVariableProp<any>>('templating/updateVariableProp');
export const removeVariable = createAction<RemoveVariable>('templating/removeVariable');
export const changeVariableType = createAction<ChangeVariableType>('templating/changeVariableType');

export const templatingReducer = (state: TemplatingState = initialState, action: AnyAction): TemplatingState => {
  if (createVariable.match(action)) {
    const variable = {} as VariableModel;
    assignModelProperties(variable, action.payload.model, action.payload.defaults);
    const id = state.nextId;
    const lastId = id;
    const nextId = lastId + 1;
    const newVariable = { ...variable, id };

    return {
      ...state,
      variables: [...state.variables, newVariable],
      lastId,
      nextId,
    };
  }

  if (updateVariableProp.match(action)) {
    const { id, propName, value } = action.payload;
    if (id === -1) {
      return state;
    }

    return {
      ...state,
      variables: state.variables.map(variable => {
        if (variable?.id !== id) {
          return variable;
        }

        return {
          ...variable,
          [propName]: value,
        };
      }),
    };
  }

  if (removeVariable.match(action)) {
    const { id } = action.payload;
    if (id === -1) {
      return state;
    }

    const variables = reorganizeIds(state.variables.filter(variable => variable.id !== id));
    const lastId = variables.length - 1;
    const nextId = variables.length;

    return {
      ...state,
      variables,
      lastId,
      nextId,
    };
  }

  if (changeVariableType.match(action)) {
    const { id, defaults } = action.payload;
    if (id === -1) {
      return state;
    }

    return {
      ...state,
      variables: state.variables.map(variable => {
        if (variable?.id !== id) {
          return variable;
        }

        return { ...defaults, id, name: variable.name, label: variable.label };
      }),
    };
  }

  if (cleanUpDashboard.match(action)) {
    return initialState;
  }

  return state;
};

export default {
  templating: templatingReducer,
};
