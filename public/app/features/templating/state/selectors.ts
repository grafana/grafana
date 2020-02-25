import { cloneDeep } from 'lodash';

import { StoreState } from '../../../types';
import { VariableActions, VariableModel } from '../variable';
import { getState } from '../../../store/store';
import { emptyUuid, VariableState } from './types';
import { variableAdapters } from '../adapters';

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

export const getVariableStates = (state: StoreState = getState()): VariableState[] => {
  const variableStates = Object.values(state.templating.variables).map(state => cloneDeep(state));
  return variableStates.sort((s1, s2) => s1.variable.index - s2.variable.index);
};

export const getAllVariables = (
  angularVariables: Array<VariableModel & VariableActions>,
  state: StoreState = getState()
) => {
  const reduxVariables = getVariables(state) as Array<VariableModel & VariableActions>;
  return angularVariables.concat(reduxVariables).sort((a, b) => a.index - b.index);
};

export const getAllVariablesJSON = (
  angularVariables: Array<VariableModel & VariableActions>,
  state: StoreState = getState()
): Array<Partial<VariableModel>> => {
  return getAllVariables(angularVariables, state).map(variable => {
    if (variableAdapters.contains(variable.type)) {
      return variableAdapters.get(variable.type).getSaveModel(variable);
    }
    return variable.getSaveModel ? variable.getSaveModel() : variable;
  });
};
