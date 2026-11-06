import { t } from '@grafana/i18n';
import { type ManagerKind } from 'app/features/apiserver/types';
import { type DashboardsTreeItem } from 'app/features/browse-dashboards/types';

/** Marks a folder the user can see but not pick. Being read only is why it's disabled, so both are always set. */
export function toReadOnlyTreeItem(treeItem: DashboardsTreeItem): DashboardsTreeItem {
  return { ...treeItem, readOnly: true, disabled: true };
}

export const getRootFolderItem = (): DashboardsTreeItem => ({
  isOpen: true,
  level: 0,
  item: {
    kind: 'folder' as const,
    title: t('browse-dashboards.folder-picker.root-title', 'Dashboards'),
    uid: '',
  },
});

export const getCustomRootFolderItem = ({
  title,
  managedBy,
  managerId,
  uid,
}: {
  title: string;
  managedBy?: ManagerKind;
  managerId?: string;
  uid: string;
}): DashboardsTreeItem => ({
  isOpen: true,
  level: 0,
  item: {
    kind: 'folder' as const,
    title,
    uid,
    managedBy,
    managerId,
  },
});
