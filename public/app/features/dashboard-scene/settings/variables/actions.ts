import { type SceneObject, sceneGraph, type SceneVariable, SceneVariableSet } from '@grafana/scenes';

import { dashboardEditActions } from '../../edit-pane/shared';
import { type DashboardScene } from '../../scene/DashboardScene';
import { DashboardInteractions } from '../../utils/interactions';

import { getVariableDefault } from './utils';

export function openAddVariablePane(dashboard: DashboardScene) {
  const variablesSet = sceneGraph.getVariables(dashboard);

  if (!(variablesSet instanceof SceneVariableSet)) {
    return;
  }

  const allVars = [...(variablesSet.state.variables ?? []), ...collectDescendantVariables(dashboard)];

  dashboardEditActions.addVariable({
    source: variablesSet,
    addedObject: getVariableDefault(allVars),
  });
  DashboardInteractions.newVariableTypeSelected({ type: 'query' });
}

export function openAddSectionVariablePane(dashboard: DashboardScene, sectionOwner: SceneObject) {
  const existing = sectionOwner.state.$variables;
  const variablesSet = existing instanceof SceneVariableSet ? existing : new SceneVariableSet({ variables: [] });

  if (!(existing instanceof SceneVariableSet)) {
    sectionOwner.setState({ $variables: variablesSet });
  }

  const dashboardVars = sceneGraph.getVariables(dashboard).state.variables ?? [];
  const sectionVars = variablesSet.state.variables ?? [];
  const allVars = [...dashboardVars, ...sectionVars];

  dashboardEditActions.addVariable({
    source: variablesSet,
    addedObject: getVariableDefault(allVars),
  });
  DashboardInteractions.newSectionVariableTypeSelected({ type: 'query' });
}

export function collectDescendantVariables(sceneObject: SceneObject): SceneVariable[] {
  const result: SceneVariable[] = [];
  sceneObject.forEachChild((child) => {
    if (child.state.$variables instanceof SceneVariableSet) {
      result.push(...child.state.$variables.state.variables);
    }
    result.push(...collectDescendantVariables(child));
  });
  return result;
}
