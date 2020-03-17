import { cloneDeep } from 'lodash';

import { StoreState } from '../../../types';
import { VariableModel } from '../../templating/variable';
import { getState } from '../../../store/store';
import { NEW_VARIABLE_ID } from './types';

export const getVariable = <T extends VariableModel = VariableModel>(id: string, state: StoreState = getState()): T => {
  if (!state.templating.variables[id]) {
    throw new Error(`Couldn't find variable with id:${id}`);
  }

  return state.templating.variables[id] as T;
};

export const getVariableWithName = (name: string, state: StoreState = getState()) => {
  return Object.values(state.templating.variables).find(variable => variable.name === name);
};

export const getVariables = (state: StoreState = getState()): VariableModel[] => {
  return Object.values(state.templating.variables).filter(variable => variable.id! !== NEW_VARIABLE_ID);
};

export const getVariableClones = (state: StoreState = getState(), includeEmptyUuid = false): VariableModel[] => {
  const variables = Object.values(state.templating.variables)
    .filter(variable => (includeEmptyUuid ? true : variable.id !== NEW_VARIABLE_ID))
    .map(variable => cloneDeep(variable));
  return variables.sort((s1, s2) => s1.index! - s2.index!);
};
