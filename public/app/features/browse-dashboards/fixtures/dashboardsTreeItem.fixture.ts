import { Chance } from 'chance';

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

export function wellFormedTree() {
  let seed = 1;

  // prettier-ignore so its easier to see the tree structure
  /* prettier-ignore */ const folderA = wellFormedFolder(seed++);
  /* prettier-ignore */ const folderA_folderA = wellFormedFolder(seed++, { level: 1}, { parentUID: folderA.item.uid });
  /* prettier-ignore */ const folderA_folderB = wellFormedFolder(seed++, { level: 1}, { parentUID: folderA.item.uid });
  /* prettier-ignore */ const folderA_folderB_dashbdA = wellFormedDashboard(seed++, { level: 2}, { parentUID: folderA_folderB.item.uid });
  /* prettier-ignore */ const folderA_folderB_dashbdB = wellFormedDashboard(seed++, { level: 2}, { parentUID: folderA_folderB.item.uid });
  /* prettier-ignore */ const folderA_folderC = wellFormedFolder(seed++, { level: 1},{ parentUID: folderA.item.uid });
  /* prettier-ignore */ const folderA_folderC_dashbdA = wellFormedDashboard(seed++, { level: 2}, { parentUID: folderA_folderC.item.uid });
  /* prettier-ignore */ const folderA_folderC_dashbdB = wellFormedDashboard(seed++, { level: 2}, { parentUID: folderA_folderC.item.uid });
  /* prettier-ignore */ const folderA_dashbdD = wellFormedDashboard(seed++, { level: 1}, { parentUID: folderA.item.uid });
  /* prettier-ignore */ const folderB = wellFormedFolder(seed++);
  /* prettier-ignore */ const folderB_empty = wellFormedEmptyFolder(seed++);
  /* prettier-ignore */ const folderC = wellFormedFolder(seed++);
  /* prettier-ignore */ const dashbdD = wellFormedDashboard(seed++);
  /* prettier-ignore */ const dashbdE = wellFormedDashboard(seed++);

  return [
    [
      folderA,
      folderA_folderA,
      folderA_folderB,
      folderA_folderB_dashbdA,
      folderA_folderB_dashbdB,
      folderA_folderC,
      folderA_folderC_dashbdA,
      folderA_folderC_dashbdB,
      folderA_dashbdD,
      folderB,
      folderB_empty,
      folderC,
      dashbdD,
      dashbdE,
    ],
    {
      folderA,
      folderA_folderA,
      folderA_folderB,
      folderA_folderB_dashbdA,
      folderA_folderB_dashbdB,
      folderA_folderC,
      folderA_folderC_dashbdA,
      folderA_folderC_dashbdB,
      folderA_dashbdD,
      folderB,
      folderB_empty,
      folderC,
      dashbdD,
      dashbdE,
    },
  ] as const;
}
