import { StoreState } from '../../../types';
import { VariableActions, VariableModel } from '../variable';
import { getState } from '../../../store/store';
import { VariableState } from './types';
import { variableAdapters } from '../adapters';

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
  return Object.values(state.templating.variables).map(state => ({ ...state.variable }));
};

export const getAllVariables = (angularVariables: VariableModel[], state: StoreState = getState()): VariableModel[] => {
  return angularVariables.concat(getVariables(state)).sort((a, b) => a.index - b.index);
};

export const getAllVariablesJSON = (
  angularVariables: VariableModel[],
  state: StoreState = getState()
): Array<Partial<VariableModel>> => {
  return getAllVariables(angularVariables, state).map((variable: VariableModel & VariableActions) => {
    if (variableAdapters.contains(variable.type)) {
      return variableAdapters.get(variable.type).getSaveModel(variable);
    }
    return variable.getSaveModel ? variable.getSaveModel() : variable;
  });
};
