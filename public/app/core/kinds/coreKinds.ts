import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { API_GROUP as PLAYLIST_API_GROUP } from '@grafana/api-clients/rtkq/playlist/v1';
import { API_GROUP as PROVISIONING_API_GROUP } from '@grafana/api-clients/rtkq/provisioning/v0alpha1';
import { t } from '@grafana/i18n';
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
    searchKind: 'folder',
    pluralLabel: () => t('provisioning.resource-kind.folders', 'Folders'),
    icon: 'folder',
    url: '/dashboards/f/{name}',
    listUrl: '/dashboards',
  },
  dashboard: {
    group: DASHBOARD_API_GROUP,
    kind: 'Dashboard',
    resource: 'dashboards',
    searchKind: 'dashboard',
    pluralLabel: () => t('provisioning.resource-kind.dashboards', 'Dashboards'),
    icon: 'apps',
    url: '/d/{name}',
    titleSlug: true,
    listUrl: '/dashboards',
  },
  playlist: {
    group: PLAYLIST_API_GROUP,
    kind: 'Playlist',
    resource: 'playlists',
    pluralLabel: () => t('provisioning.resource-kind.playlists', 'Playlists'),
    icon: 'presentation-play',
    // The edit page, not /playlists/play, which starts the fullscreen slideshow at once
    url: '/playlists/edit/{name}',
    listUrl: '/playlists',
  },
  // No `url`: a library panel has no page of its own, only its row on the collection page
  librarypanel: {
    // Served from the dashboards group, under its own plural
    group: DASHBOARD_API_GROUP,
    kind: 'LibraryPanel',
    resource: 'librarypanels',
    pluralLabel: () => t('provisioning.resource-kind.library-panels', 'Library panels'),
    icon: 'library-panel',
    listUrl: '/library-panels',
  },
  repository: {
    group: PROVISIONING_API_GROUP,
    kind: 'Repository',
    resource: 'repositories',
    pluralLabel: () => t('provisioning.resource-kind.repositories', 'Repositories'),
    icon: 'code-branch',
    url: `${PROVISIONING_URL}/{name}`,
    listUrl: PROVISIONING_URL,
  },
  connection: {
    group: PROVISIONING_API_GROUP,
    kind: 'Connection',
    resource: 'connections',
    pluralLabel: () => t('provisioning.resource-kind.connections', 'Connections'),
    icon: 'plug',
    url: `${CONNECTIONS_URL}/{name}/edit`,
    listUrl: CONNECTIONS_URL,
  },
  datasource: {
    // Not a served group but the storage collection the group of every data source plugin is
    // stored in: each plugin serves its own `{plugin}.datasource.grafana.app`
    group: 'datasource.grafana.app',
    kind: 'DataSource',
    resource: 'datasources',
    pluralLabel: () => t('provisioning.resource-kind.datasources', 'Data sources'),
    icon: 'database',
    url: '/connections/datasources/edit/{name}',
    listUrl: '/connections/datasources',
  },
} satisfies Record<string, KindInfo>;
