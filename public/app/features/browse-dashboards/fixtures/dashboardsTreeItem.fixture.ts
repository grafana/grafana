import { Chance } from 'chance';

import { DashboardViewItem } from 'app/features/search/types';

import { DashboardsTreeItem } from '../types';

/**
 * @deprecated Use wellFormedTree from @grafana/test-utils/unstable instead (or re-evaluate test approach in general)
 */
export function wellFormedDashboard(
  seed = 1,
  partial?: Partial<DashboardsTreeItem<DashboardViewItem>>,
  itemPartial?: Partial<DashboardViewItem>
): DashboardsTreeItem<DashboardViewItem> {
  const random = Chance(seed);

  return {
    item: {
      kind: 'dashboard',
      title: random.sentence({ words: 3 }),
      uid: random.guid(),
      tags: [random.word()],
      ...itemPartial,
    },
    level: 0,
    isOpen: false,
    ...partial,
  };
}

/**
 * @deprecated Use wellFormedTree from @grafana/test-utils/unstable instead (or re-evaluate test approach in general)
 */
export function wellFormedFolder(
  seed = 1,
  partial?: Partial<DashboardsTreeItem<DashboardViewItem>>,
  itemPartial?: Partial<DashboardViewItem>
): DashboardsTreeItem<DashboardViewItem> {
  const random = Chance(seed);
  const uid = random.guid();

  return {
    item: {
      kind: 'folder',
      title: random.sentence({ words: 3 }),
      uid,
      url: `/dashboards/f/${uid}`,
      ...itemPartial,
    },
    level: 0,
    isOpen: false,
    ...partial,
  };
}

/**
 * @deprecated Use wellFormedTree from @grafana/test-utils/unstable instead (or re-evaluate test approach in general)
 */
export function sharedWithMeFolder(seed = 1): DashboardsTreeItem<DashboardViewItem> {
  const folder = wellFormedFolder(seed, undefined, {
    uid: 'sharedwithme',
    url: undefined,
  });
  return folder;
}
