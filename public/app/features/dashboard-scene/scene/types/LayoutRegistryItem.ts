import { RegistryItem } from '@grafana/data';

import { DashboardLayoutManager, TransitionManager } from './DashboardLayoutManager';

/**
 * The layout descriptor used when selecting / switching layouts
 */
export interface LayoutRegistryItem<S = {}> extends RegistryItem {
  transitionManager: TransitionManager;

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
