import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { t } from '@grafana/i18n';
import kbn from 'app/core/utils/kbn';

import { type KindInfo } from './types';

/**
 * Folders and dashboards, the kinds several features show side by side. The one place that says
 * what each is called, which icon it gets and where its pages are, so every list shows them the
 * same way.
 *
 * The plural labels keep the translation keys they had before this table existed: a renamed key
 * would show untranslated until it is translated again.
 */
export const CORE_KINDS = {
  folder: {
    group: FOLDER_API_GROUP,
    kind: 'Folder',
    resource: 'folders',
    pluralLabel: () => t('provisioning.resource-kind.folders', 'Folders'),
    icon: 'folder',
    getRoute: (name: string) => `/dashboards/f/${encodeURIComponent(name)}`,
    listRoute: '/dashboards',
  },
  dashboard: {
    group: DASHBOARD_API_GROUP,
    kind: 'Dashboard',
    resource: 'dashboards',
    pluralLabel: () => t('provisioning.resource-kind.dashboards', 'Dashboards'),
    icon: 'apps',
    getRoute: (name: string, title?: string) => {
      const path = `/d/${encodeURIComponent(name)}`;
      return title === undefined ? path : `${path}/${kbn.slugifyForUrl(title)}`;
    },
    listRoute: '/dashboards',
  },
} satisfies Record<string, KindInfo>;
