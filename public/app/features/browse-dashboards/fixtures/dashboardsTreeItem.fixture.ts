import { Chance } from 'chance';

import { DashboardViewItem } from 'app/features/search/types';

import { DashboardsTreeItem } from '../types';

export function wellFormedEmptyFolder(): DashboardsTreeItem {
  return {
    item: {
      kind: 'ui-empty-folder',
    },
    level: 0,
    isOpen: false,
  };
}

export function wellFormedDashboard(random = Chance(1)): DashboardsTreeItem<DashboardViewItem> {
  return {
    item: {
      kind: 'dashboard',
      title: random.sentence({ words: 3 }),
      uid: random.guid(),
      tags: [random.word()],
    },
    level: 0,
    isOpen: false,
  };
}

export function wellFormedFolder(random = Chance(2)): DashboardsTreeItem<DashboardViewItem> {
  return {
    item: {
      kind: 'folder',
      title: random.sentence({ words: 3 }),
      uid: random.guid(),
    },
    level: 0,
    isOpen: true,
  };
}
