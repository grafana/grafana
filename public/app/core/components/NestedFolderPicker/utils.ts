import { type SearchDashboardsAndFoldersApiArg } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { t } from '@grafana/i18n';
import { type ManagerKind } from 'app/features/apiserver/types';
import { type DashboardsTreeItem } from 'app/features/browse-dashboards/types';

/**
 * Search args that return which of the named folders the user can pick.
 * Picking needs `dashboards:create` in the folder, but the search API can only check `folders:write` for now.
 */
export function getSelectableFoldersArgs(names: string[]): SearchDashboardsAndFoldersApiArg {
  return { type: 'folder', permission: 'edit', name: names, limit: names.length };
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
