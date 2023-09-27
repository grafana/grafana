import { DashboardViewItem } from 'app/features/search/types';

import { BrowseDashboardsState } from '../types';

export function findItem(
  rootItems: DashboardViewItem[],
  childrenByUID: BrowseDashboardsState['childrenByParentUID'],
  uid: string
): DashboardViewItem | undefined {
  for (const item of rootItems) {
    if (item.uid === uid) {
      return item;
    }
  }

  for (const parentUID in childrenByUID) {
    const children = childrenByUID[parentUID];
    if (!children) {
      continue;
    }

    for (const child of children.items) {
      if (child.uid === uid) {
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
