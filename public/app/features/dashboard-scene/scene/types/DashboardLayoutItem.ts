import { SceneObject, VizPanel } from '@grafana/scenes';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
/**
 * Abstraction to handle editing of different layout elements (wrappers for VizPanels and other objects)
 * Also useful to when rendering / viewing an element outside it's layout scope
 */
export interface DashboardLayoutItem extends SceneObject {
  /**
   * Marks this object as a layout item
   */
  isDashboardLayoutItem: true;

  /**
   * Return layout item options (like repeat, repeat direction, etc. for the default DashboardGridItem)
   */
  getOptions?(): OptionsPaneCategoryDescriptor[];

  /**
   * Change inner body / viz panel
   */
  setElementBody(body: VizPanel): void;
}

export function isDashboardLayoutItem(obj: SceneObject): obj is DashboardLayoutItem {
  return 'isDashboardLayoutItem' in obj;
}
