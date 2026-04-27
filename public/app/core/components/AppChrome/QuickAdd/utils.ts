import type { NavModelItem } from '@grafana/data/types';
import type { IconName } from '@grafana/ui/types';

export interface CreateActionGroup {
  parentId: string;
  parentText: string;
  items: NavModelItem[];
}

export const ITEM_ICONS: Record<string, IconName> = {
  'dashboards/new': 'plus',
  'browse-template-dashboard': 'grid',
  'dashboards/import': 'import',
  alert: 'plus',
  folder: 'folder',
};

export const DASHBOARD_GROUP_COLOR_NAME = 'semi-dark-green';
export const ALERTING_GROUP_COLOR_LIGHT_NAME = 'light-purple';
export const ALERTING_GROUP_COLOR_DARK_NAME = 'semi-dark-purple';

export function findCreateActionGroups(navTree: NavModelItem[]): CreateActionGroup[] {
  const groupMap = new Map<string, CreateActionGroup>();
  collectCreateActions(navTree, groupMap, undefined);

  return Array.from(groupMap.values());
}

/**
 * Recursively walks the nav tree, collecting items marked with `isCreateAction`
 * into groups keyed by their parent node. Top-level items (no parent) are placed
 * in an ungrouped bucket with an empty key, which renders without a group header.
 */
function collectCreateActions(
  items: NavModelItem[],
  groupMap: Map<string, CreateActionGroup>,
  parent: NavModelItem | undefined
) {
  for (const navItem of items) {
    if (navItem.isCreateAction) {
      // Use parent id as group key; empty string for top-level (ungrouped) items
      const key = parent ? (parent.id ?? parent.text) : '';
      let group = groupMap.get(key);
      if (!group) {
        // parentText is empty for ungrouped items, which suppresses the Menu.Group label
        group = { parentId: key, parentText: parent?.text ?? '', items: [] };
        groupMap.set(key, group);
      }
      group.items.push(navItem);
    }
    // Recurse into children, passing the current node as the new parent
    if (navItem.children) {
      collectCreateActions(navItem.children, groupMap, navItem);
    }
  }
}
