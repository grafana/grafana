import {
  SceneTimePicker,
  SceneRefreshPicker,
  VizPanel,
  SceneGridItem,
  SceneGridRow,
  SceneDataLayers,
  sceneGraph,
} from '@grafana/scenes';

import { DashboardControls } from '../scene/DashboardControls';
import { DashboardScene } from '../scene/DashboardScene';
import { VizPanelLinks } from '../scene/PanelLinks';

function getTimePicker(scene: DashboardScene) {
  const dashboardControls = getDashboardControls(scene);

  if (dashboardControls) {
    const timePicker = dashboardControls.state.timeControls.find((c) => c instanceof SceneTimePicker);
    if (timePicker && timePicker instanceof SceneTimePicker) {
      return timePicker;
    }
  }

  return null;
}

function getRefreshPicker(scene: DashboardScene) {
  const dashboardControls = getDashboardControls(scene);

  if (dashboardControls) {
    for (const control of dashboardControls.state.timeControls) {
      if (control instanceof SceneRefreshPicker) {
        return control;
      }
    }
  }
  return null;
}

function getDashboardControls(scene: DashboardScene) {
  if (scene.state.controls?.[0] instanceof DashboardControls) {
    return scene.state.controls[0];
  }
  return null;
}

function getPanelLinks(panel: VizPanel) {
  if (
    panel.state.titleItems &&
    Array.isArray(panel.state.titleItems) &&
    panel.state.titleItems[0] instanceof VizPanelLinks
  ) {
    return panel.state.titleItems[0];
  }

  throw new Error('VizPanelLinks links not found');
}

function getVizPanels(scene: DashboardScene): VizPanel[] {
  const panels: VizPanel[] = [];

  scene.state.body.forEachChild((child) => {
    if (child instanceof SceneGridItem) {
      if (child.state.body instanceof VizPanel) {
        panels.push(child.state.body);
      }
    } else if (child instanceof SceneGridRow) {
      child.forEachChild((child) => {
        if (child instanceof SceneGridItem) {
          if (child.state.body instanceof VizPanel) {
            panels.push(child.state.body);
          }
        }
      });
    }
  });

  return panels;
}

function getDataLayers(scene: DashboardScene): SceneDataLayers {
  const data = sceneGraph.getData(scene);

  if (!(data instanceof SceneDataLayers)) {
    throw new Error('SceneDataLayers not found');
  }

  return data;
}

export const dashboardSceneGraph = {
  getTimePicker,
  getRefreshPicker,
  getDashboardControls,
  getPanelLinks,
  getVizPanels,
  getDataLayers,
};
