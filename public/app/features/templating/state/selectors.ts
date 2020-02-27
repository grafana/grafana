import { cloneDeep } from 'lodash';

import { StoreState } from '../../../types';
import { VariableModel } from '../variable';
import { getState } from '../../../store/store';
import { emptyUuid, VariableState } from './types';

export const getVariable = <T extends VariableModel = VariableModel>(
  uuid: string,
  state: StoreState = getState()
): T => {
  if (!state.templating.variables[uuid]) {
    throw new Error(`Couldn't find variable with uuid:${uuid}`);
  }

  return state.templating.variables[uuid].variable as T;
};

export const getVariableWithName = (name: string, state: StoreState = getState()) => {
  return Object.values(state.templating.variables).find(state => state.variable.name === name)?.variable;
};

export const getVariables = (state: StoreState = getState()): VariableModel[] => {
  return Object.values(state.templating.variables)
    .filter(state => state.variable.uuid! !== emptyUuid)
    .map(state => state.variable);
};

export const getVariableStates = (state: StoreState = getState(), includeEmptyUuid = false): VariableState[] => {
  const variableStates = Object.values(state.templating.variables)
    .filter(state => (includeEmptyUuid ? true : state.variable.uuid !== emptyUuid))
    .map(state => cloneDeep(state));
  return variableStates.sort((s1, s2) => s1.variable.index! - s2.variable.index!);
};
