import { t } from '@grafana/i18n';
import { ManagerKind } from 'app/features/apiserver/types';
import { DashboardsTreeItem } from 'app/features/browse-dashboards/types';

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
  uid,
}: {
  title: string;
  managedBy?: ManagerKind;
  uid?: string;
}): DashboardsTreeItem => ({
  isOpen: true,
  level: 0,
  item: {
    kind: 'folder' as const,
    title,
    uid: uid || '',
    managedBy,
  },
});
