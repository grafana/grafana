import { useMemo } from 'react';

import { t } from '@grafana/i18n';

import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { type DashboardLayoutManager, isDashboardLayoutManager } from '../types/DashboardLayoutManager';

export const MAX_NESTING_DEPTH = 4;

/**
 * Returns the maximum group-nesting depth of a layout subtree.
 * A grid layout has depth 0, rows-of-grids has depth 1, rows > tabs > grid has depth 2, etc.
 */
export function getGroupDepth(layout: DashboardLayoutManager): number {
  if (layout instanceof RowsLayoutManager) {
    return 1 + Math.max(0, ...layout.state.rows.map((row) => getGroupDepth(row.state.layout)));
  }
  if (layout instanceof TabsLayoutManager) {
    return 1 + Math.max(0, ...layout.state.tabs.map((tab) => getGroupDepth(tab.state.layout)));
  }
  return 0;
}

/**
 * Computes whether the "group into rows/tabs" actions (addNewRowTo/addNewTabTo)
 * are allowed for the given layout manager.
 *
 * When the layout manager is not already a group of the requested type, the
 * action wraps it in a new group, pushing the layout and everything nested
 * inside it one level deeper -- so the subtree depth counts towards the limit,
 * not just the ancestor groups.
 */
export function useNestingRestrictions(layoutManager: DashboardLayoutManager) {
  return useMemo(() => {
    let ancestorGroups = 0;
    let nearestGroupIsTabs = false;

    let parent = layoutManager.parent;
    while (parent) {
      if (isDashboardLayoutManager(parent)) {
        if (ancestorGroups === 0) {
          nearestGroupIsTabs = parent instanceof TabsLayoutManager;
        }
        ancestorGroups++;
      }
      parent = parent.parent;
    }

    // Adding a row: rows layouts just get a new row (no new layer); tabs
    // layouts delegate to the current tab's layout (wrapping it one level
    // deeper when it isn't rows); grids get wrapped in a new rows layer.
    let disableGrouping: boolean;
    if (layoutManager instanceof RowsLayoutManager) {
      disableGrouping = false;
    } else if (layoutManager instanceof TabsLayoutManager) {
      const currentTabLayout = layoutManager.getCurrentTab()?.state.layout;
      disableGrouping = !(currentTabLayout instanceof RowsLayoutManager) && ancestorGroups + 2 > MAX_NESTING_DEPTH;
    } else {
      disableGrouping = ancestorGroups + 1 > MAX_NESTING_DEPTH;
    }

    // Adding a tab: tabs layouts just get a new tab (no new layer); anything
    // else gets wrapped (with its whole subtree) in a new tabs layer, which is
    // also rejected when it would sit directly inside another tabs layout.
    const disableTabs =
      layoutManager instanceof TabsLayoutManager
        ? false
        : nearestGroupIsTabs || ancestorGroups + 1 + getGroupDepth(layoutManager) > MAX_NESTING_DEPTH;

    return { disableGrouping, disableTabs };
  }, [layoutManager]);
}

export function getNestingRestrictionMessage(): string {
  return t('dashboard.canvas-actions.disabled-nested-grouping', 'Grouping is limited to {{maxDepth}} levels', {
    maxDepth: MAX_NESTING_DEPTH,
  });
}
