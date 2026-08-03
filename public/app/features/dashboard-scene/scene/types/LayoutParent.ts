import { type AnyDashboardLayoutManager, type DashboardLayoutManager } from './DashboardLayoutManager';

/**
 * This interface is needed to support layouts existing on different levels of the scene (DashboardScene and inside the TabsLayoutManager)
 */
export interface LayoutParent {
  /**
   * Returns the inner layout manager. Any kind, to match DashboardScene.getLayout(): the same
   * object is reachable through this interface, and on a notebook it is a notebook layout manager.
   */
  getLayout(): AnyDashboardLayoutManager;

  /**
   * Switches the inner layout manager
   * @param newLayout The new layout manager to switch to
   * @param skipUndo If true, skips creating an undo entry for this operation
   */
  switchLayout(newLayout: DashboardLayoutManager, skipUndo?: boolean): void;
}

export function isLayoutParent(obj: object): obj is LayoutParent {
  return 'switchLayout' in obj;
}
