import { type NavModelItem } from '@grafana/data';
import { type IconName } from '@grafana/ui';

export interface CreateActionGroup {
  parentId: string;
  parentText: string;
  items: NavModelItem[];
}

export const ITEM_ICONS: Record<string, IconName> = {
  'dashboards/new': 'plus',
  'browse-template-dashboard': 'apps',
  'dashboards/import': 'cloud-download',
  alert: 'plus',
};

export function findCreateActionGroups(navTree: NavModelItem[]): CreateActionGroup[] {
  const groupMap = new Map<string, CreateActionGroup>();
  collectCreateActions(navTree, groupMap, undefined);

  return Array.from(groupMap.values());
}

function collectCreateActions(
  items: NavModelItem[],
  groupMap: Map<string, CreateActionGroup>,
  parent: NavModelItem | undefined
) {
  for (const navItem of items) {
    if (navItem.isCreateAction && parent) {
      const key = parent.id ?? parent.text;
      let group = groupMap.get(key);
      if (!group) {
        group = { parentId: key, parentText: parent.text, items: [] };
        groupMap.set(key, group);
      }
      group.items.push(navItem);
    }
    if (navItem.children) {
      collectCreateActions(navItem.children, groupMap, navItem);
    }
  }
}
