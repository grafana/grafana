import { SceneTimePicker, SceneRefreshPicker, VizPanel } from '@grafana/scenes';

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

export const dashboardSceneGraph = {
  getTimePicker,
  getRefreshPicker,
  getDashboardControls,
  getPanelLinks,
};
