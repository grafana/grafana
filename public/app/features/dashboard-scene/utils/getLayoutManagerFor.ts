import type { SceneObject } from '@grafana/scenes';
import {
  type DashboardLayoutManager,
  isDashboardLayoutManager,
} from 'app/features/dashboard-scene/scene/types/DashboardLayoutManager';

export function getLayoutManagerFor(sceneObject: SceneObject): DashboardLayoutManager {
  let parent = sceneObject.parent;

  while (parent) {
    if (isDashboardLayoutManager(parent)) {
      return parent;
    }
    parent = parent.parent;
  }

  throw new Error('Could not find layout manager for scene object');
}
