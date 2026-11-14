import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { API_GROUP as PLAYLIST_API_GROUP } from '@grafana/api-clients/rtkq/playlist/v1';
import { API_GROUP as PROVISIONING_API_GROUP } from '@grafana/api-clients/rtkq/provisioning/v0alpha1';
import { t } from '@grafana/i18n';
import kbn from 'app/core/utils/kbn';
import { CONNECTIONS_URL, PROVISIONING_URL } from 'app/features/provisioning/constants';

import { type KindInfo } from './types';

/**
 * The kinds Grafana serves itself. The one place that says what each is called, which icon it gets
 * and where its pages are, so that every list of mixed kinds shows a kind the same way.
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
  playlist: {
    group: PLAYLIST_API_GROUP,
    kind: 'Playlist',
    resource: 'playlists',
    pluralLabel: () => t('provisioning.resource-kind.playlists', 'Playlists'),
    icon: 'presentation-play',
    // The edit page, not /playlists/play, which starts the fullscreen slideshow at once
    getRoute: (name: string) => `/playlists/edit/${encodeURIComponent(name)}`,
    listRoute: '/playlists',
  },
  // No `getRoute`: a library panel has no page of its own, only its row on the collection page
  librarypanel: {
    // Served from the dashboards group, under its own plural
    group: DASHBOARD_API_GROUP,
    kind: 'LibraryPanel',
    resource: 'librarypanels',
    pluralLabel: () => t('provisioning.resource-kind.library-panels', 'Library panels'),
    icon: 'library-panel',
    listRoute: '/library-panels',
  },
  repository: {
    group: PROVISIONING_API_GROUP,
    kind: 'Repository',
    resource: 'repositories',
    pluralLabel: () => t('provisioning.resource-kind.repositories', 'Repositories'),
    icon: 'code-branch',
    getRoute: (name: string) => `${PROVISIONING_URL}/${encodeURIComponent(name)}`,
    listRoute: PROVISIONING_URL,
  },
  connection: {
    group: PROVISIONING_API_GROUP,
    kind: 'Connection',
    resource: 'connections',
    pluralLabel: () => t('provisioning.resource-kind.connections', 'Connections'),
    icon: 'plug',
    getRoute: (name: string) => `${CONNECTIONS_URL}/${encodeURIComponent(name)}/edit`,
    listRoute: CONNECTIONS_URL,
  },
  datasource: {
    // Not a served group but the storage collection the group of every data source plugin is
    // stored in: each plugin serves its own `{plugin}.datasource.grafana.app`
    group: 'datasource.grafana.app',
    collectionGroup: true,
    kind: 'DataSource',
    resource: 'datasources',
    pluralLabel: () => t('provisioning.resource-kind.datasources', 'Data sources'),
    icon: 'database',
    getRoute: (name: string) => `/connections/datasources/edit/${encodeURIComponent(name)}`,
    listRoute: '/connections/datasources',
  },
} satisfies Record<string, KindInfo>;
