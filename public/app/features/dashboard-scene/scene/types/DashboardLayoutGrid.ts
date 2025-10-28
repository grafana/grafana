import { DashboardLayoutManager } from './DashboardLayoutManager';

export interface DashboardLayoutGrid extends DashboardLayoutManager {
  /**
   * Merge the layout with another layout
   */
  mergeGrid(other: DashboardLayoutGrid): void;
}

export function isDashboardLayoutGrid(obj: DashboardLayoutManager): obj is DashboardLayoutGrid {
  return 'mergeGrid' in obj;
}
