import { t } from '@grafana/i18n';

export const getRootFolderItem = (title?: string) => ({
  isOpen: true,
  level: 0,
  item: {
    kind: 'folder' as const,
    title: title
      ? t('browse-dashboards.folder-picker.root-title-custom', title)
      : t('browse-dashboards.folder-picker.root-title', 'Dashboards'),
    uid: '',
  },
});
