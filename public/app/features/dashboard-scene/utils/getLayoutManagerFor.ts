import { type SceneObject } from '@grafana/scenes';

import { type DashboardLayoutManager, isDashboardLayoutManager } from '../scene/types/DashboardLayoutManager';

/**
 * Walks up the scene graph to find the layout manager that owns the given object.
 *
 * Kept in its own module (rather than in the larger `utils/utils.ts` hub) so leaf views such as
 * the grouping actions can resolve a layout manager without importing the whole utils barrel,
 * which would drag them into the layout-manager import cycle.
 */
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
