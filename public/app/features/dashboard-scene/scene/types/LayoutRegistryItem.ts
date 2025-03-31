import { RegistryItem } from '@grafana/data';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';

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

  /**
   * Schema kind of layout
   */
  kind?: DashboardV2Spec['layout']['kind'];

  /**
   * Is grid layout (that contains panels)
   */
  isGridLayout: boolean;
}
