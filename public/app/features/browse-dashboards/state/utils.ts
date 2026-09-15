import { type DashboardViewItem, type DashboardViewItemKind } from 'app/features/search/types';

import { type BrowseDashboardsState } from '../types';

/**
 * Finds the item with the given kind and uid in either the root items or childrenByUID. UIDs are unique per kind
 * only, so callers must say which kind they want.
 */
export function findItem(
  rootItems: DashboardViewItem[],
  childrenByUID: BrowseDashboardsState['childrenByParentUID'],
  kind: DashboardViewItemKind,
  uid: string
): DashboardViewItem | undefined {
  for (const item of rootItems) {
    if (item.kind === kind && item.uid === uid) {
      return item;
    }
  }

  for (const parentUID in childrenByUID) {
    const children = childrenByUID[parentUID];
    if (!children) {
      continue;
    }

    for (const child of children.items) {
      if (child.kind === kind && child.uid === uid) {
        return child;
      }
    }
  }

  return undefined;
}

export function getPaginationPlaceholders(amount: number, parentUID: string | undefined, level: number) {
  return new Array(amount).fill(null).map((_, index) => {
    return {
      parentUID,
      level,
      isOpen: false,
      item: {
        kind: 'ui' as const,
        uiKind: 'pagination-placeholder' as const,
        uid: `${parentUID}-pagination-${index}`,
      },
    };
  });
}
