import type { SceneObject } from '@grafana/scenes';
import type { DashboardSceneState } from 'app/features/dashboard-scene/scene/DashboardScene';
import { useDashboard } from 'app/features/dashboard-scene/utils/useDashboard';

export function useDashboardState(scene: SceneObject): DashboardSceneState {
  const dashboard = useDashboard(scene);
  return dashboard.useState();
}
