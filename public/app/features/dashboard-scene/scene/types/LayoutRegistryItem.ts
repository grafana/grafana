import { RegistryItem } from '@grafana/data';

import { DashboardLayoutManager } from './DashboardLayoutManager';

/**
 * The layout descriptor used when selecting / switching layouts
 */
export interface LayoutRegistryItem<S = {}> extends RegistryItem {
  /**
   * When switching between layouts
   * @param currentLayout
   */
  createFromLayout(currentLayout: DashboardLayoutManager): DashboardLayoutManager;

  /**
   * Create from persisted state
   * @param saveModel
   */
  createFromSaveModel?(saveModel: S): void;
}
