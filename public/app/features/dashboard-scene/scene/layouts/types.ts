import { SceneObject } from '@grafana/scenes';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

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
   * Return layout elements options (like repeat, repeat direction, etc for the default DashboardGridItem)
   */
  useLayoutOptions(): OptionsPaneItemDescriptor[];
}

export function isDashboardLayoutElement(obj: SceneObject): obj is DashboardLayoutElement {
  return 'isDashboardLayoutElement' in obj;
}
