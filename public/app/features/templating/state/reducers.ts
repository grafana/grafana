import { assignModelProperties, VariableModel } from '../variable';
import { reducerFactory } from '../../../core/redux';
import { createVariable, removeVariable, updateVariableProp } from './actions';

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

export const templatingReducer = reducerFactory<TemplatingState>(initialState)
  .addMapper({
    filter: createVariable,
    mapper: (state, action): TemplatingState => {
      const variable = {} as VariableModel;
      assignModelProperties(variable, action.payload.model, action.payload.defaults);
      const id = state.nextId;
      const lastId = id;
      const nextId = lastId + 1;

      return {
        ...state,
        variables: [...state.variables, { ...variable, id }],
        lastId,
        nextId,
      };
    },
  })
  .addMapper({
    filter: updateVariableProp,
    mapper: (state, action): TemplatingState => {
      const { id, propName, value } = action.payload;
      if (id === -1) {
        return state;
      }

      return {
        ...state,
        variables: state.variables.map(variable => {
          if (variable.id !== id) {
            return variable;
          }

          return {
            ...variable,
            [propName]: value,
          };
        }),
      };
    },
  })
  .addMapper({
    filter: removeVariable,
    mapper: (state, action): TemplatingState => {
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
    },
  })
  .create();

export default {
  templating: templatingReducer,
};
