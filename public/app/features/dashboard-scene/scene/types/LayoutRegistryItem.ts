import { type IconName, type RegistryItem } from '@grafana/data';

import { type AnyDashboardLayoutManager } from './DashboardLayoutManager';

/**
 * The layout descriptor used when selecting / switching layouts
 */
export interface LayoutRegistryItem extends RegistryItem {
  /**
   * When switching between layouts
   * @param currentLayout
   */
  createFromLayout(currentLayout: AnyDashboardLayoutManager): AnyDashboardLayoutManager;

  /**
   * Is grid layout (that contains panels)
   */
  isGridLayout: boolean;

  /**
   * icon name
   */
  icon: IconName;
}
