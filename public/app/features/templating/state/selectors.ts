import { StoreState } from '../../../types';
import { VariableModel } from '../variable';

export const getVariable = <T extends VariableModel = VariableModel>(name: string, state: StoreState): T => {
  const variables = getVariables(state);
  const variable = variables.find(v => v.name === name);
  if (!variable) {
    throw new Error(`Couldn't find variable with name:${name}`);
  }

  return variable as T;
};

export const getVariables = (state: StoreState): VariableModel[] => {
  const queryVariables = state.templating.query.map(s => s.variable);
  return [].concat(queryVariables);
};
