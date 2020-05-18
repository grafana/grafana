import { StoreState } from '../../../types';
import { VariableModel } from '../../templating/types';
import { getState } from '../../../store/store';
import { NEW_VARIABLE_ID } from './types';

export const getVariable = <T extends VariableModel = VariableModel>(
  id: string,
  state: StoreState = getState(),
  throwWhenMissing = true
): T => {
  if (!state.templating.variables[id]) {
    if (throwWhenMissing) {
      throw new Error(`Couldn't find variable with id:${id}`);
    }
    return (undefined as unknown) as T;
  }

  return state.templating.variables[id] as T;
};

export const getFilteredVariables = (filter: (model: VariableModel) => boolean, state: StoreState = getState()) => {
  return Object.values(state.templating.variables)
    .filter(filter)
    .sort((s1, s2) => s1.index! - s2.index!);
};

export const getVariableWithName = (name: string, state: StoreState = getState()) => {
  return getVariable(name, state, false);
};

export const getVariables = (state: StoreState = getState(), includeNewVariable = false): VariableModel[] => {
  return getFilteredVariables(variable => (includeNewVariable ? true : variable.id! !== NEW_VARIABLE_ID), state);
};

export type GetVariables = typeof getVariables;

export const getNewVariabelIndex = (state: StoreState = getState()): number => {
  return Object.values(state.templating.variables).length;
};
