import { upperFirst } from 'lodash';

import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { API_GROUP as PLAYLIST_API_GROUP } from '@grafana/api-clients/rtkq/playlist/v1';
import { API_GROUP as PROVISIONING_API_GROUP } from '@grafana/api-clients/rtkq/provisioning/v0alpha1';
import { t } from '@grafana/i18n';

import { CONNECTIONS_ROUTE, PROVISIONING_ROUTE } from './routes';
import { type KindInfo, type LabelOptions } from './types';

// Every page path is built here, so the object name is encoded in one place
function page(base: string, suffix = '') {
  return (name: string) => `${base}/${encodeURIComponent(name)}${suffix}`;
}

// Titles are derived from the mid-sentence label here, so no reader changes a label's case itself
function label(translate: () => string) {
  return ({ upperFirst: upper = true }: LabelOptions = {}) => (upper ? upperFirst(translate()) : translate());
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
    searchKind: 'folder',
    getLabel: label(() => t('core-kinds.folder.label', 'folder')),
    getPluralLabel: label(() => t('core-kinds.folder.label-plural', 'folders')),
    icon: 'folder',
    getRoute: page('/dashboards/f'),
  },
  dashboard: {
    group: DASHBOARD_API_GROUP,
    kind: 'Dashboard',
    resource: 'dashboards',
    searchKind: 'dashboard',
    getLabel: label(() => t('core-kinds.dashboard.label', 'dashboard')),
    getPluralLabel: label(() => t('core-kinds.dashboard.label-plural', 'dashboards')),
    icon: 'apps',
    getRoute: page('/d'),
  },
  playlist: {
    group: PLAYLIST_API_GROUP,
    kind: 'Playlist',
    resource: 'playlists',
    getLabel: label(() => t('core-kinds.playlist.label', 'playlist')),
    getPluralLabel: label(() => t('core-kinds.playlist.label-plural', 'playlists')),
    icon: 'presentation-play',
    // The edit page, not /playlists/play, which starts the fullscreen slideshow at once
    getRoute: page('/playlists/edit'),
  },
  // No `getRoute`: a library panel has no page of its own, only its row on the collection page
  librarypanel: {
    // Served from the dashboards group, under its own plural
    group: DASHBOARD_API_GROUP,
    kind: 'LibraryPanel',
    resource: 'librarypanels',
    getLabel: label(() => t('core-kinds.librarypanel.label', 'library panel')),
    getPluralLabel: label(() => t('core-kinds.librarypanel.label-plural', 'library panels')),
    icon: 'library-panel',
  },
  repository: {
    group: PROVISIONING_API_GROUP,
    kind: 'Repository',
    resource: 'repositories',
    getLabel: label(() => t('core-kinds.repository.label', 'repository')),
    getPluralLabel: label(() => t('core-kinds.repository.label-plural', 'repositories')),
    icon: 'code-branch',
    getRoute: page(PROVISIONING_ROUTE),
  },
  connection: {
    group: PROVISIONING_API_GROUP,
    kind: 'Connection',
    resource: 'connections',
    getLabel: label(() => t('core-kinds.connection.label', 'connection')),
    getPluralLabel: label(() => t('core-kinds.connection.label-plural', 'connections')),
    icon: 'plug',
    getRoute: page(CONNECTIONS_ROUTE, '/edit'),
  },
  datasource: {
    // Each data source plugin serves its own `{plugin}.datasource.grafana.app`
    group: 'datasource.grafana.app',
    collectionGroup: true,
    kind: 'DataSource',
    resource: 'datasources',
    getLabel: label(() => t('core-kinds.datasource.label', 'data source')),
    getPluralLabel: label(() => t('core-kinds.datasource.label-plural', 'data sources')),
    icon: 'database',
    getRoute: page('/connections/datasources/edit'),
  },
} as const satisfies Record<string, KindInfo>;

const kinds: KindInfo[] = Object.values(CORE_KINDS);

/**
 * Whether `group` names this kind: its own group, or for a collection kind a group served inside the
 * collection, which is the group a single object carries.
 */
export function coversGroup(kind: KindInfo, group: string): boolean {
  return kind.group === group || (kind.collectionGroup === true && group.endsWith(`.${kind.group}`));
}

/** The kind an object of this API group and Kubernetes kind belongs to. */
export function findKind(group: string, kind: string): KindInfo | undefined {
  return kinds.find((row) => row.kind === kind && coversGroup(row, group));
}

/** The kind behind a dashboard search row's kind string; undefined for rows such as panels. */
export function findKindBySearchKind(searchKind: string): KindInfo | undefined {
  return kinds.find((row) => row.searchKind === searchKind);
}
