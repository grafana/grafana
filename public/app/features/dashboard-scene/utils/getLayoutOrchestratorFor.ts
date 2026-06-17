import type { SceneObject } from '@grafana/scenes';
import type { DashboardLayoutOrchestrator } from 'app/features/dashboard-scene/scene/DashboardLayoutOrchestrator';
import { getDashboardSceneFor } from 'app/features/dashboard-scene/utils/getDashboardSceneFor';

export function getLayoutOrchestratorFor(scene: SceneObject): DashboardLayoutOrchestrator | undefined {
  return getDashboardSceneFor(scene).state.layoutOrchestrator;
}
