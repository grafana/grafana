import { SceneGridItemLike } from '@grafana/scenes';

import { DashboardLayoutManager } from './DashboardLayoutManager';

export interface DashboardLayoutGrid extends DashboardLayoutManager {
  /**
   * Merge the layout with another layout
   */
  mergeGrid(other: DashboardLayoutGrid): void;
  /**
   * Add a grid item to the layout
   */
  addGridItem(gridItem: SceneGridItemLike): void;
}

export function isDashboardLayoutGrid(obj: DashboardLayoutManager): obj is DashboardLayoutGrid {
  return 'mergeGrid' in obj && 'addGridItem' in obj;
}
