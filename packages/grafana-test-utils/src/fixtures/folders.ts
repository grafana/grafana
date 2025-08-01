import { Chance } from 'chance';

import { DashboardsTreeItem, DashboardViewItem, UIDashboardViewItem } from '../types/browse-dashboards';

function wellFormedEmptyFolder(
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

function wellFormedDashboard(
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

function wellFormedFolder(
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

export function treeViewersCanEdit() {
  const [, { folderA, folderC }] = wellFormedTree();

  return [
    [folderA, folderC],
    {
      folderA,
      folderC,
    },
  ] as const;
}

export function wellFormedTree() {
  let seed = 1;

  const folderA = wellFormedFolder(seed++);
  const folderA_folderA = wellFormedFolder(seed++, { level: 1 }, { parentUID: folderA.item.uid });
  const folderA_folderB = wellFormedFolder(seed++, { level: 1 }, { parentUID: folderA.item.uid });
  const folderA_folderB_dashbdA = wellFormedDashboard(seed++, { level: 2 }, { parentUID: folderA_folderB.item.uid });
  const folderA_folderB_dashbdB = wellFormedDashboard(seed++, { level: 2 }, { parentUID: folderA_folderB.item.uid });
  const folderA_folderC = wellFormedFolder(seed++, { level: 1 }, { parentUID: folderA.item.uid });
  const folderA_folderC_dashbdA = wellFormedDashboard(seed++, { level: 2 }, { parentUID: folderA_folderC.item.uid });
  const folderA_folderC_dashbdB = wellFormedDashboard(seed++, { level: 2 }, { parentUID: folderA_folderC.item.uid });
  const folderA_dashbdD = wellFormedDashboard(seed++, { level: 1 }, { parentUID: folderA.item.uid });
  const folderB = wellFormedFolder(seed++);
  const folderB_empty = wellFormedEmptyFolder(seed++);
  const folderC = wellFormedFolder(seed++);
  const dashbdD = wellFormedDashboard(seed++);
  const dashbdE = wellFormedDashboard(seed++);

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
