import { SceneObject } from '@grafana/scenes';

import { DashboardLayoutManager } from './DashboardLayoutManager';

/**
 * This interface is needed to support layouts existing on different levels of the scene (DashboardScene and inside the TabsLayoutManager)
 */
export interface LayoutParent extends SceneObject {
  /**
   * Returns the inner layout manager
   */
  getLayout(): DashboardLayoutManager;

  /**
   * Switches the inner layout manager
   * @param newLayout
   */
  switchLayout(newLayout: DashboardLayoutManager): void;
}

export function isLayoutParent(obj: SceneObject): obj is LayoutParent {
  return 'switchLayout' in obj;
}
