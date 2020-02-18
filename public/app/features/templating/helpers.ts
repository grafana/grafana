import { VariableActions, VariableModel } from './variable';
import { variableAdapters } from './adapters';
import { emptyUuid } from './state/types';
import { getState } from '../../store/store';

export const processVariableDependencies = async (
  variable: VariableModel & VariableActions,
  angularVariables: Array<VariableModel & VariableActions>
) => {
  const reduxVariables = Object.values(getState().templating.variables)
    .filter(state => state.variable.uuid! !== emptyUuid)
    .map(state => state.variable as VariableModel & VariableActions);
  const allVariables = angularVariables.concat(reduxVariables).sort((a, b) => a.index - b.index);

  let dependencies: Array<Promise<any>> = [];

  for (const otherVariable of allVariables) {
    if (variable === otherVariable) {
      continue;
    }

    if (variableAdapters.contains(variable.type)) {
      if (variableAdapters.get(variable.type).dependsOn(variable, otherVariable)) {
        dependencies.push(otherVariable.initLock.promise);
      }
      continue;
    }

    if (!variableAdapters.contains(variable.type)) {
      if (variable.dependsOn(otherVariable)) {
        dependencies.push(otherVariable.initLock.promise);
      }
    }
  }

  await Promise.all(dependencies);
};
