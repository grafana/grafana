import { SceneObject } from '@grafana/scenes';

import { DashboardLayoutManager } from './DashboardLayoutManager';

/**
 * This interface is needed to support layouts existing on different levels of the scene (DashboardScene and inside the TabsLayoutManager)
 */
export interface LayoutParent extends SceneObject {
  switchLayout(newLayout: DashboardLayoutManager): void;
}

export function isLayoutParent(obj: SceneObject): obj is LayoutParent {
  return 'switchLayout' in obj;
}
