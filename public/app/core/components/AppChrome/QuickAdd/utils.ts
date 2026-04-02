import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type IconName } from '@grafana/ui';

export interface CreateActionGroup {
  parentId: string;
  parentText: string;
  items: NavModelItem[];
}

export interface GroupDisplay {
  label: () => string;
  iconColor: (theme: GrafanaTheme2) => string;
}

export interface ItemDisplay {
  label: () => string;
  icon: IconName;
}

export const GROUP_DISPLAY: Record<string, GroupDisplay> = {
  'dashboards/browse': {
    label: () => t('navigation.quick-add.group-dashboard', 'New dashboard'),
    iconColor: (theme) => theme.visualization.getColorByName('green'),
  },
  alerting: {
    label: () => t('navigation.quick-add.group-alert-rule', 'New alert rule'),
    iconColor: (theme) => theme.visualization.getColorByName('purple'),
  },
};

export const ITEM_DISPLAY: Record<string, ItemDisplay> = {
  'dashboards/new': { label: () => t('navigation.quick-add.blank', 'Blank'), icon: 'plus' },
  'browse-template-dashboard': { label: () => t('navigation.quick-add.from-template', 'From template'), icon: 'apps' },
  'dashboards/import': { label: () => t('navigation.quick-add.import', 'Import'), icon: 'cloud-download' },
  alert: { label: () => t('navigation.quick-add.create', 'Create'), icon: 'plus' },
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
