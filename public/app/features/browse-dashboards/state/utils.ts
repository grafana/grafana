import { DashboardViewItem } from 'app/features/search/types';

export function findItem(
  rootItems: DashboardViewItem[],
  childrenByUID: Record<string, DashboardViewItem[] | undefined>,
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

    for (const child of children) {
      if (child.uid === uid) {
        return child;
      }
    }
  }

  return undefined;
}
