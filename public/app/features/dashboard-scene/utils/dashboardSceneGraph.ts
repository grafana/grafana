import { SceneTimePicker, SceneRefreshPicker } from '@grafana/scenes';

import { DashboardControls } from '../scene/DashboardControls';
import { DashboardScene } from '../scene/DashboardScene';

function getTimePicker(scene: DashboardScene) {
  const controls = scene.state.controls;

  if (controls && controls[0] instanceof DashboardControls) {
    const dashboardControls = controls[0];
    const timePicker = dashboardControls.state.timeControls.find((c) => c instanceof SceneTimePicker);
    if (timePicker && timePicker instanceof SceneTimePicker) {
      return timePicker;
    }
  }

  return null;
}

function getRefreshPicker(scene: DashboardScene) {
  if (scene.state.controls?.[0] instanceof DashboardControls) {
    for (const control of scene.state.controls[0].state.timeControls) {
      if (control instanceof SceneRefreshPicker) {
        return control;
      }
    }
  }
  return null;
}

export const dashboardSceneGraph = {
  getTimePicker,
  getRefreshPicker,
};
