import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { API_GROUP as PLAYLIST_API_GROUP } from '@grafana/api-clients/rtkq/playlist/v1';
import { API_GROUP as PROVISIONING_API_GROUP } from '@grafana/api-clients/rtkq/provisioning/v0alpha1';
import { t } from '@grafana/i18n';

import { CONNECTIONS_ROUTE, PROVISIONING_ROUTE } from './routes';
import { type CollectionKindInfo, type KindInfo } from './types';

// Every page path is built here, so the object name is encoded in one place
function page(base: string, suffix = '') {
  return (name: string) => `${base}/${encodeURIComponent(name)}${suffix}`;
}

/**
 * Kinds Grafana serves itself, each described once: what it is called, which icon it gets and where
 * its pages are, so that every list of mixed kinds shows a kind the same way.
 */
export const CORE_KINDS = {
  folder: {
    group: FOLDER_API_GROUP,
    kind: 'Folder',
    resource: 'folders',
    getLabel: ({ plural = false } = {}) =>
      plural ? t('core-kinds.folder.label-plural', 'folders') : t('core-kinds.folder.label', 'folder'),
    icon: 'folder',
    getRoute: page('/dashboards/f'),
    listRoute: '/dashboards',
  },
  dashboard: {
    group: DASHBOARD_API_GROUP,
    kind: 'Dashboard',
    resource: 'dashboards',
    getLabel: ({ plural = false } = {}) =>
      plural ? t('core-kinds.dashboard.label-plural', 'dashboards') : t('core-kinds.dashboard.label', 'dashboard'),
    icon: 'apps',
    getRoute: page('/d'),
    listRoute: '/dashboards',
  },
  playlist: {
    group: PLAYLIST_API_GROUP,
    kind: 'Playlist',
    resource: 'playlists',
    getLabel: ({ plural = false } = {}) =>
      plural ? t('core-kinds.playlist.label-plural', 'playlists') : t('core-kinds.playlist.label', 'playlist'),
    icon: 'presentation-play',
    // The edit page, not /playlists/play, which starts the fullscreen slideshow at once
    getRoute: page('/playlists/edit'),
    listRoute: '/playlists',
  },
  // No `getRoute`: a library panel has no page of its own, only its row on the collection page
  librarypanel: {
    // Served from the dashboards group, under its own plural
    group: DASHBOARD_API_GROUP,
    kind: 'LibraryPanel',
    resource: 'librarypanels',
    getLabel: ({ plural = false } = {}) =>
      plural
        ? t('core-kinds.librarypanel.label-plural', 'library panels')
        : t('core-kinds.librarypanel.label', 'library panel'),
    icon: 'library-panel',
    listRoute: '/library-panels',
  },
  repository: {
    group: PROVISIONING_API_GROUP,
    kind: 'Repository',
    resource: 'repositories',
    getLabel: ({ plural = false } = {}) =>
      plural ? t('core-kinds.repository.label-plural', 'repositories') : t('core-kinds.repository.label', 'repository'),
    icon: 'code-branch',
    getRoute: page(PROVISIONING_ROUTE),
    listRoute: PROVISIONING_ROUTE,
  },
  connection: {
    group: PROVISIONING_API_GROUP,
    kind: 'Connection',
    resource: 'connections',
    getLabel: ({ plural = false } = {}) =>
      plural ? t('core-kinds.connection.label-plural', 'connections') : t('core-kinds.connection.label', 'connection'),
    icon: 'plug',
    getRoute: page(CONNECTIONS_ROUTE, '/edit'),
    listRoute: CONNECTIONS_ROUTE,
  },
  datasource: {
    // Each data source plugin serves its own `{plugin}.datasource.grafana.app`
    collection: 'datasource.grafana.app',
    kind: 'DataSource',
    resource: 'datasources',
    getLabel: ({ plural = false } = {}) =>
      plural
        ? t('core-kinds.datasource.label-plural', 'data sources')
        : t('core-kinds.datasource.label', 'data source'),
    icon: 'database',
    getRoute: page('/connections/datasources/edit'),
    listRoute: '/connections/datasources',
  },
} as const satisfies Record<string, KindInfo | CollectionKindInfo>;
