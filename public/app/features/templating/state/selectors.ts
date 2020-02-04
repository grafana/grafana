import { StoreState } from '../../../types';
import { VariableModel } from '../variable';
import { getState } from '../../../store/store';
import { VariableState } from './types';

export const getVariableByName = <T extends VariableModel = VariableModel>(
  name: string,
  state: StoreState = getState()
): T => {
  const variable = getVariables(state).find(v => v.name === name);
  return variable as T;
};

export const getVariableState = <T extends VariableState = VariableState>(
  uuid: string,
  state: StoreState = getState()
): T => {
  if (!state.templating.variables[uuid]) {
    throw new Error(`Couldn't find variable with uuid:${uuid}`);
  }

  return state.templating.variables[uuid] as T;
};

export const getVariable = <T extends VariableModel = VariableModel>(
  uuid: string,
  state: StoreState = getState()
): T => {
  return getVariableState(uuid, state).variable as T;
};

export const getVariables = (state: StoreState = getState()): VariableModel[] => {
  return Object.values(state.templating.variables).map(state => state.variable);
};
