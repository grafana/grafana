import { cloneDeep } from 'lodash';

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
    return undefined;
  }

  return state.templating.variables[id] as T;
};

export const getFilteredVariables = (filter: (model: VariableModel) => boolean, state: StoreState = getState()) => {
  return Object.values(state.templating.variables).filter(filter);
};

export const getVariableWithName = (name: string) => {
  return getVariable(name, getState(), false);
};

export const getVariables = (state: StoreState = getState()): VariableModel[] => {
  return getFilteredVariables(variable => variable.id! !== NEW_VARIABLE_ID, state);
};

export const getVariableClones = (state: StoreState = getState(), includeEmptyUuid = false): VariableModel[] => {
  const variables = getFilteredVariables(
    variable => (includeEmptyUuid ? true : variable.id! !== NEW_VARIABLE_ID),
    state
  ).map(variable => cloneDeep(variable));
  return variables.sort((s1, s2) => s1.index! - s2.index!);
};

export const getNewVariabelIndex = (state: StoreState = getState()): number => {
  return Object.values(state.templating.variables).length;
};
