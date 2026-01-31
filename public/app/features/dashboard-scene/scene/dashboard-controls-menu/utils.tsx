import { config } from '@grafana/runtime';
import { SceneDataState, sceneGraph, SceneVariable } from '@grafana/scenes';
import { DashboardLink, VariableHide } from '@grafana/schema';

import { isDashboardDataLayerSetState } from '../DashboardDataLayerSet';
import { DashboardScene } from '../DashboardScene';

export function getDashboardControlsLinks(links: DashboardLink[]) {
  return links.filter((link) => link.placement === 'inControlsMenu');
}

export function getDashboardControlsVariables(variables: SceneVariable[]) {
  return variables.filter((v) => v.state.hide === VariableHide.inControlsMenu);
}

export function getDashboardControlsAnnotations(dataState: SceneDataState, isEditingNewLayouts?: boolean) {
  return (isDashboardDataLayerSetState(dataState) ? dataState.annotationLayers : []).filter(
    (layer) => layer.state.placement === 'inControlsMenu' && (!layer.state.isHidden || isEditingNewLayouts)
  );
}

export function getDashboardControls(dashboard: DashboardScene) {
  const variables = getDashboardControlsVariables(sceneGraph.getVariables(dashboard)?.state.variables);
  const links = getDashboardControlsLinks(dashboard.state.links);
  const isEditingNewLayouts = dashboard.state.isEditing && config.featureToggles.dashboardNewLayouts;
  const annotations = getDashboardControlsAnnotations(sceneGraph.getData(dashboard).state, isEditingNewLayouts);

  return {
    variables,
    links,
    annotations,
  };
}

export function useDashboardControls(dashboard: DashboardScene) {
  const dashboardState = dashboard.useState();
  const variablesState = sceneGraph.getVariables(dashboard).useState();
  const dataState = sceneGraph.getData(dashboard).useState();
  const isEditingNewLayouts = dashboardState.isEditing && config.featureToggles.dashboardNewLayouts;
  const links = getDashboardControlsLinks(dashboardState.links);
  const variables = getDashboardControlsVariables(variablesState.variables);
  const annotations = getDashboardControlsAnnotations(dataState, isEditingNewLayouts);

  return {
    variables,
    links,
    annotations,
    isEditingNewLayouts,
  };
}

export function useHasDashboardControls(dashboard: DashboardScene) {
  const { variables, links, annotations } = useDashboardControls(dashboard);

  return variables.length > 0 || links.length > 0 || annotations.length > 0;
}

export function hasDashboardControls(dashboard: DashboardScene) {
  const { variables, links, annotations } = getDashboardControls(dashboard);

  return variables.length > 0 || links.length > 0 || annotations.length > 0;
}
