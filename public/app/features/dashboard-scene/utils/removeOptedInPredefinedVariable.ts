import { sceneGraph, type SceneVariable } from '@grafana/scenes';

import { updateDashboardScopeVariable } from '../sidebar/dashboard/DashboardCrossDashboardVariablesOptions';

import { type PredefinedVariableScope } from './crossDashboardVariablesSelection';
import { fetchPredefinedVariables, getPredefinedOrigin } from './predefinedVariables';
import { getDashboardSceneFor } from './utils';

/**
 * Names to pass when unchecking one opted-in variable.
 * A scope stored as "all" expands to this list, so it must include every sibling
 * that should stay opted in. When the fetch does not include the variable, fall
 * back to the names already on the dashboard.
 */
export function namesForPredefinedRemoval(fetchedNames: string[], name: string, namesOnDashboard: string[]): string[] {
  if (fetchedNames.includes(name)) {
    return fetchedNames;
  }

  const present = namesOnDashboard.includes(name) ? namesOnDashboard : [...namesOnDashboard, name];
  return [...new Set([...fetchedNames, ...present])];
}

/** Opt a global or folder variable out of this dashboard. The variable definition is left in place. */
export async function removeOptedInPredefinedVariable(variable: SceneVariable): Promise<void> {
  const origin = getPredefinedOrigin(variable.state.origin);
  if (!origin) {
    return;
  }

  const dashboard = getDashboardSceneFor(variable);
  const fetched = await fetchPredefinedVariables(dashboard.state.meta.folderUid);
  const allNamesInScope = namesForPredefinedRemoval(
    namesInScope(fetched, origin.type),
    variable.state.name,
    namesOnDashboard(dashboard, origin.type)
  );

  updateDashboardScopeVariable(dashboard, origin.type, variable.state.name, false, allNamesInScope);
}

function namesInScope(
  fetched: Awaited<ReturnType<typeof fetchPredefinedVariables>>,
  scope: PredefinedVariableScope
): string[] {
  return (fetched ?? [])
    .filter((candidate) => getPredefinedOrigin(candidate.spec.origin)?.type === scope)
    .map((candidate) => candidate.spec.name);
}

function namesOnDashboard(
  dashboard: ReturnType<typeof getDashboardSceneFor>,
  scope: PredefinedVariableScope
): string[] {
  return sceneGraph
    .getVariables(dashboard)
    .state.variables.filter((candidate) => getPredefinedOrigin(candidate.state.origin)?.type === scope)
    .map((candidate) => candidate.state.name);
}
