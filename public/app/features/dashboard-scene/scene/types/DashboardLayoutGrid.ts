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
  onDragStart?(sourceGrid: DashboardLayoutGrid, layoutItem: DashboardLayoutItem, evt: PointerEvent): void;

  onDragStop?(
    sourceGrid: DashboardLayoutGrid,
    targetGrid: DashboardLayoutGrid,
    layoutItem: DashboardLayoutItem,
    evt: PointerEvent
  ): void;

  /**
   * Toggle the grid as the current drop target
   * Useful for toggling between inner drag and outer drag
   */
  onDrag?(
    sourceGrid: DashboardLayoutGrid,
    targetGrid: DashboardLayoutGrid,
    layoutItem: DashboardLayoutItem,
    evt: PointerEvent
  ): void;
}

export function isDashboardLayoutGrid(obj: DashboardLayoutManager): obj is DashboardLayoutGrid {
  return 'mergeGrid' in obj && 'addGridItem' in obj;
}
