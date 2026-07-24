import { useMemo } from 'react';

import { t } from '@grafana/i18n';

import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { type DashboardLayoutManager, isDashboardLayoutManager } from '../types/DashboardLayoutManager';

export const MAX_NESTING_DEPTH = 4;

export function useNestingRestrictions(layoutManager: DashboardLayoutManager) {
  return useMemo(() => {
    const layouts: string[] = [];
    let parent = layoutManager.parent;

    while (parent) {
      if (isDashboardLayoutManager(parent)) {
        layouts.push(parent.descriptor.id);
      }

      if (layouts.length === MAX_NESTING_DEPTH) {
        break;
      }

      parent = parent.parent;
    }

    const disableGrouping = layouts.length >= MAX_NESTING_DEPTH;
    const disableTabs = disableGrouping || layouts[0] === TabsLayoutManager.descriptor.id;

    return { disableGrouping, disableTabs };
  }, [layoutManager]);
}

export function getNestingRestrictionMessage(): string {
  return t('dashboard.canvas-actions.disabled-nested-grouping', 'Grouping is limited to {{maxDepth}} levels', {
    maxDepth: MAX_NESTING_DEPTH,
  });
}
