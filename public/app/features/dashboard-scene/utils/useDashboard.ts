import type { SceneObject } from '@grafana/scenes';
import type { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { getDashboardSceneFor } from 'app/features/dashboard-scene/utils/getDashboardSceneFor';

export function useDashboard(scene: SceneObject): DashboardScene {
  return getDashboardSceneFor(scene);
}
