import { Chance } from 'chance';

import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { DashboardViewItem } from 'app/features/search/types';

import { DashboardsTreeItem, UIDashboardViewItem } from '../types';

export function wellFormedEmptyFolder(
  seed = 1,
  partial?: Partial<DashboardsTreeItem<UIDashboardViewItem>>
): DashboardsTreeItem<UIDashboardViewItem> {
  const random = Chance(seed);

  return {
    item: {
      kind: 'ui',
      uiKind: 'empty-folder',
      uid: random.guid(),
    },
    level: 0,
    isOpen: false,
    ...partial,
  };
}

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

export function sharedWithMeFolder(seed = 1): DashboardsTreeItem<DashboardViewItem> {
  const folder = wellFormedFolder(seed, undefined, {
    uid: 'sharedwithme',
    url: undefined,
  });
  return folder;
}

export function treeViewersCanEdit() {
  const [, { folderA, folderC }] = getFolderFixtures();

  return [
    [folderA, folderC],
    {
      folderA,
      folderC,
    },
  ] as const;
}
