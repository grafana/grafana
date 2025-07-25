import { VizPanel } from '@grafana/scenes';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

export const addPanel = (vizPanel: VizPanel) => {
  const dashboardScene = window.__grafanaSceneContext instanceof DashboardScene ? window.__grafanaSceneContext : null;
  return dashboardScene?.addPanel(vizPanel);
};
