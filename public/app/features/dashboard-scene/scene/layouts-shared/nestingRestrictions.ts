import { useMemo } from 'react';

import { config } from '@grafana/runtime';

import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { type DashboardLayoutManager, isDashboardLayoutManager } from '../types/DashboardLayoutManager';

const MAX_NESTING_DEPTH = 3;

export function getNestingRestrictions(layoutManager: DashboardLayoutManager) {
  if (config.featureToggles.unlimitedLayoutsNesting) {
    return { disableGrouping: false, disableTabs: false };
  }

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
  const disableTabs = disableGrouping || layouts.includes(TabsLayoutManager.descriptor.id);

  return { disableGrouping, disableTabs };
}

export function useNestingRestrictions(layoutManager: DashboardLayoutManager) {
  return useMemo(() => getNestingRestrictions(layoutManager), [layoutManager]);
}
