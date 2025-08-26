import { IconName, RegistryItem } from '@grafana/data';

import { DashboardLayoutManager } from './DashboardLayoutManager';

/**
 * The layout descriptor used when selecting / switching layouts
 */
export interface LayoutRegistryItem extends RegistryItem {
  /**
   * When switching between layouts
   * @param currentLayout
   */
  createFromLayout(currentLayout: DashboardLayoutManager): DashboardLayoutManager;

  /**
   * Is grid layout (that contains panels)
   */
  isGridLayout: boolean;

  /**
   * icon name
   */
  icon: IconName;
}
