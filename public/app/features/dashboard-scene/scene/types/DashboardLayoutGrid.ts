import { SceneGridItemLike } from '@grafana/scenes';

import { DashboardLayoutItem } from './DashboardLayoutItem';
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

  /**
   * Start the synchronization of the orchestrator with the grid drag
   */
  startOrchestratorSync?(): void;

  stopOrchestratorSync?(sourceGrid: DashboardLayoutGrid, targetGrid: DashboardLayoutGrid, layoutItem: DashboardLayoutItem): void;

  /**
   * Toggle the grid as the current drop target
   * Useful for toggling between inner drag and outer drag
   */
  setIsDropTarget?(flag: boolean, sourceGrid: DashboardLayoutGrid, layoutItem: DashboardLayoutItem): void;
}

export function isDashboardLayoutGrid(obj: DashboardLayoutManager): obj is DashboardLayoutGrid {
  return 'mergeGrid' in obj && 'addGridItem' in obj;
}
