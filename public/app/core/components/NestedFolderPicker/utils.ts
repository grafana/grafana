import { t } from '@grafana/i18n';

export const getRootFolderItem = () => ({
  isOpen: true,
  level: 0,
  item: {
    kind: 'folder' as const,
    title: t('browse-dashboards.folder-picker.root-title', 'Dashboards'),
    uid: '',
  },
});
