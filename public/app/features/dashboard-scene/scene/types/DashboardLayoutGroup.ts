import { type GridLayoutType } from '../layouts-shared/utils';

import { type DashboardLayoutManager } from './DashboardLayoutManager';

export type NestedGroupsTarget = 'rows' | 'tabs';

export interface DashboardLayoutGroup extends DashboardLayoutManager {
  /**
   * Flatten the group and all nested groups into a single grid of the given type
   * @param gridLayoutType
   */
  ungroup(gridLayoutType: GridLayoutType): void;

  /**
   * Remove this grouping level while preserving content structure:
   * nested groups are hoisted up a level and other children are converted to the target group type
   * @param target
   */
  hoistNestedGroups(target: NestedGroupsTarget): void;

  /**
   * Convert all layouts to the given grid layout type
   * @param gridLayoutType
   */
  convertAllGridLayouts(gridLayoutType: GridLayoutType): void;
}

export function isDashboardLayoutGroup(obj: DashboardLayoutManager): obj is DashboardLayoutGroup {
  return 'ungroup' in obj && 'convertAllGridLayouts' in obj;
}
