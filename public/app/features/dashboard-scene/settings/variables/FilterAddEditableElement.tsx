import { sceneGraph, SceneVariableSet } from '@grafana/scenes';

import { dashboardEditActions } from '../../edit-pane/shared';
import { type DashboardScene } from '../../scene/DashboardScene';
import { DashboardInteractions } from '../../utils/interactions';

import { getNextAvailableId, getVariableScene } from './utils';

export function openAddFilterPane(dashboard: DashboardScene) {
  const variablesSet = sceneGraph.getVariables(dashboard);

  if (!(variablesSet instanceof SceneVariableSet)) {
    return;
  }

  const type = 'adhoc' as const;
  const newVar = getVariableScene(type, { name: getNextAvailableId(type, variablesSet.state.variables ?? []) });
  dashboardEditActions.addVariable({ source: variablesSet, addedObject: newVar });
  dashboard.state.editPane.selectObject(newVar, newVar.state.key!, { force: true, multi: false });
  DashboardInteractions.newVariableTypeSelected({ type });
}
