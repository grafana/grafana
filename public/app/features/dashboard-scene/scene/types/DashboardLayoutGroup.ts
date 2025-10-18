import { GridLayoutType } from '../layouts-shared/utils';

import { DashboardLayoutManager } from './DashboardLayoutManager';

export interface DashboardLayoutGroup extends DashboardLayoutManager {
  /**
   * Ungroup the group
   * @param gridLayoutType
   */
  ungroup(gridLayoutType: GridLayoutType): void;

  /**
   * Convert all layouts to the given grid layout type
   * @param gridLayoutType
   */
  convertAllGridLayouts(gridLayoutType: GridLayoutType): void;
}

export function isDashboardLayoutGroup(obj: DashboardLayoutManager): obj is DashboardLayoutGroup {
  return 'ungroup' in obj && 'convertAllGridLayouts' in obj;
}
