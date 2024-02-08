import { DashboardViewItem } from 'app/features/search/types';

import { BrowseDashboardsState } from '../types';

export function findItem(
  childrenCollection: BrowseDashboardsState['children'],
  uid: string
): DashboardViewItem | undefined {
  for (const key in childrenCollection) {
    const children = childrenCollection[key];

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

type KeyableArgs = {
  parentUID: string | undefined;
  excludeKinds?: string[];
};

export function getChildrenStateKey({ parentUID, excludeKinds }: KeyableArgs) {
  return JSON.stringify({
    parentUID: parentUID ?? '$$special_uid_for_grafana_root_folder', // JOSH TODO: we probably don't need to set a root folder uid, and just rely on it being undefined
    excludeKinds: excludeKinds ?? [],
  });
}
