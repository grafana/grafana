import {
  AdHocFiltersVariable,
  GroupByVariable,
  QueryVariable,
  sceneGraph,
  type SceneVariable,
  SceneVariableSet,
} from '@grafana/scenes';
import { type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { updateDashboardScopeVariable } from '../sidebar/dashboard/DashboardCrossDashboardVariablesOptions';
import { getVariableName } from '../variables/utils';

import { type PredefinedVariableScope, type ScopeSelection } from './crossDashboardVariablesSelection';
import { parseUseCrossDashboardVariablesFromHost } from './persistUseCrossDashboardVariables';
import { getPredefinedOrigin, isPredefinedOrigin } from './predefinedVariableOrigin';
import { fetchPredefinedVariables } from './predefinedVariables';
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

/**
 * Sibling names for opting one variable out.
 *
 * Returns undefined when the fetch failed, so the selection is left unchanged.
 * A failed refresh keeps the variables on screen, and a written annotation would
 * disagree with them. Also returns undefined when "all" is stored and this
 * variable was not in the fetch: the names on the dashboard are not the scope,
 * and expanding "all" to them drops variables that are still opted in.
 */
export function allNamesForPredefinedRemoval(
  fetchedNames: string[] | null,
  name: string,
  namesOnDashboard: string[],
  scopeSelection: ScopeSelection
): string[] | undefined {
  if (fetchedNames === null) {
    return undefined;
  }
  if (scopeSelection === 'all' && !fetchedNames.includes(name)) {
    return undefined;
  }
  return namesForPredefinedRemoval(fetchedNames, name, namesOnDashboard);
}

/**
 * Other opted-in global and folder variables that use this one as their datasource. While any
 * exist, removing it is a no-op: the next refresh injects it again for them.
 */
export function getPredefinedDependentNames(variable: SceneVariable): string[] {
  const set = variable.parent instanceof SceneVariableSet ? variable.parent : sceneGraph.getVariables(variable);
  return set.state.variables
    .filter(
      (candidate) =>
        candidate !== variable &&
        getPredefinedOrigin(candidate.state.origin) &&
        getDatasourceVariableName(candidate) === variable.state.name
    )
    .map((candidate) => candidate.state.name)
    .sort();
}

function getDatasourceVariableName(variable: SceneVariable): string | undefined {
  if (
    variable instanceof QueryVariable ||
    variable instanceof AdHocFiltersVariable ||
    variable instanceof GroupByVariable
  ) {
    const uid = variable.state.datasource?.uid;
    return uid ? getVariableName(uid) : undefined;
  }
  return undefined;
}

/** Opt a global or folder variable out of this dashboard. The variable definition is left in place. */
export async function removeOptedInPredefinedVariable(variable: SceneVariable): Promise<void> {
  const origin = getPredefinedOrigin(variable.state.origin);
  if (!origin || getPredefinedDependentNames(variable).length > 0) {
    return;
  }

  const dashboard = getDashboardSceneFor(variable);
  const fetched = await fetchPredefinedVariables(dashboard.state.meta.folderUid);
  const fetchedNames = fetched === null ? null : namesInScope(fetched, origin.type);
  const scopeSelection = parseUseCrossDashboardVariablesFromHost(dashboard)?.[origin.type] ?? 'none';
  const allNamesInScope = allNamesForPredefinedRemoval(
    fetchedNames,
    variable.state.name,
    namesOnDashboard(dashboard, origin.type),
    scopeSelection
  );
  if (fetched === null || allNamesInScope === undefined) {
    return;
  }

  // Same dependency context as the checkbox, so a `ds` this variable pulled in stays selected.
  updateDashboardScopeVariable(dashboard, origin.type, variable.state.name, false, allNamesInScope, {
    candidates: fetched,
    localVariableNames: localVariableNames(dashboard),
  });
}

function localVariableNames(dashboard: ReturnType<typeof getDashboardSceneFor>): string[] {
  return sceneGraph
    .getVariables(dashboard)
    .state.variables.filter((candidate) => !isPredefinedOrigin(candidate.state.origin))
    .map((candidate) => candidate.state.name);
}

function namesInScope(fetched: VariableKind[], scope: PredefinedVariableScope): string[] {
  return fetched
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
