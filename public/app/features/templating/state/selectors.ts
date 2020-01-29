import { StoreState } from '../../../types';
import { VariableModel } from '../variable';
import { getState } from '../../../store/store';

export const getVariable = <T extends VariableModel = VariableModel>(
  name: string,
  state: StoreState = getState(),
  throwIfNotFound = true
): T => {
  const variable = getVariables(state).find(v => v.name === name);
  if (!variable && throwIfNotFound) {
    throw new Error(`Couldn't find variable with name:${name}`);
  }

  return variable as T;
};

export const getVariables = (state: StoreState = getState()): VariableModel[] => {
  return state.templating.variables.map(state => state.variable);
};
