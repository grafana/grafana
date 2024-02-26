import { VizPanel, SceneGridItem, SceneGridRow, SceneDataLayers, sceneGraph } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { VizPanelLinks } from '../scene/PanelLinks';
import { PlaylistBehavior } from '../scene/PlaylistBehavior';

function getTimePicker(scene: DashboardScene) {
  return scene.state.controls?.state.timePicker;
}

function getRefreshPicker(scene: DashboardScene) {
  return scene.state.controls?.state.refreshPicker;
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

function getPlayListBehavior(scene: DashboardScene): PlaylistBehavior | undefined {
  const controller = scene.state.$behaviors?.find((behavior) => behavior instanceof PlaylistBehavior);

  if (controller instanceof PlaylistBehavior) {
    return controller;
  }

  return;
}

export const dashboardSceneGraph = {
  getTimePicker,
  getRefreshPicker,
  getPanelLinks,
  getVizPanels,
  getDataLayers,
  getPlayListBehavior,
};
