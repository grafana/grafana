import { SceneObject, VizPanel } from '@grafana/scenes';

/**
 * Abstraction to handle editing of different layout elements (wrappers for VizPanels and other objects)
 * Also useful to when rendering / viewing an element outside it's layout scope
 */
export interface DashboardLayoutElement extends SceneObject {
  /**
   * Marks this object as a layout element
   */
  isDashboardLayoutElement: true;
  /**
   * Useful to update the layout element's inner panel
   */
  setPanel(panel: VizPanel): void;

  /**
   * Get the inner panel
   */
  getPanel(): VizPanel;
}

export function isDashboardLayoutElement(obj: SceneObject): obj is DashboardLayoutElement {
  return 'isDashboardLayoutElement' in obj;
}
