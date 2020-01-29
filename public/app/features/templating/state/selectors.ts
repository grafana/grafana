import { StoreState } from '../../../types';
import { VariableModel } from '../variable';
import { getState } from '../../../store/store';

export const getVariableByName = <T extends VariableModel = VariableModel>(
  name: string,
  state: StoreState = getState()
): T => {
  const variable = getVariables(state).find(v => v.name === name);
  return variable as T;
};

export const getVariable = <T extends VariableModel = VariableModel>(
  uuid: string,
  state: StoreState = getState()
): T => {
  const variable = getVariables(state).find(v => v.uuid === uuid);
  if (!variable) {
    throw new Error(`Couldn't find variable with name:${name}`);
  }

  return variable as T;
};

export const getVariables = (state: StoreState = getState()): VariableModel[] => {
  return state.templating.variables.map(state => state.variable);
};
