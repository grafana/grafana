import { t } from '@grafana/i18n';
import { ManagerKind } from 'app/features/apiserver/types';
import { DashboardsTreeItem, DashboardViewItemWithUIItems } from 'app/features/browse-dashboards/types';

export const getRootFolderItem = (): DashboardsTreeItem<DashboardViewItemWithUIItems> => ({
  isOpen: true,
  level: 0,
  item: {
    kind: 'folder' as const,
    title: t('browse-dashboards.folder-picker.root-title', 'Dashboards'),
    uid: '',
  },
});

export const getCustomRootFolderItem = (
  title?: string,
  managedBy?: ManagerKind
): DashboardsTreeItem<DashboardViewItemWithUIItems> => ({
  isOpen: true,
  level: 0,
  item: {
    kind: 'folder' as const,
    title: title
      ? t('browse-dashboards.folder-picker.root-title-custom', '{{title}}', { title })
      : t('browse-dashboards.folder-picker.root-title', 'Dashboards'),
    uid: '',
    managedBy: managedBy,
  },
});
