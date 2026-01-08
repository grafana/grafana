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
   * @param newLayout The new layout manager to switch to
   * @param skipUndo If true, skips creating an undo entry for this operation
   */
  switchLayout(newLayout: DashboardLayoutManager, skipUndo?: boolean): void;
}

export function isLayoutParent(obj: SceneObject): obj is LayoutParent {
  return 'switchLayout' in obj;
}
