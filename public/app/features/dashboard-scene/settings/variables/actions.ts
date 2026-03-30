import { sceneGraph, SceneVariableSet } from '@grafana/scenes';

import { dashboardEditActions } from '../../edit-pane/shared';
import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardInteractions } from '../../utils/interactions';

import { getVariableDefault } from './utils';

export function openAddVariablePane(dashboard: DashboardScene) {
  const variablesSet = sceneGraph.getVariables(dashboard);

  if (!(variablesSet instanceof SceneVariableSet)) {
    return;
  }

  dashboardEditActions.addVariable({
    source: variablesSet,
    addedObject: getVariableDefault(variablesSet.state.variables ?? []),
  });
  DashboardInteractions.newVariableTypeSelected({ type: 'query' });
}
