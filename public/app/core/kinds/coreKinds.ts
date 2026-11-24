import { upperFirst } from 'lodash';

import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { API_GROUP as PLAYLIST_API_GROUP } from '@grafana/api-clients/rtkq/playlist/v1';
import { API_GROUP as PROVISIONING_API_GROUP } from '@grafana/api-clients/rtkq/provisioning/v0alpha1';
import { t } from '@grafana/i18n';
import { type CoreKindKey, type KindInfo, type KindLabelOptions, type KindRegistry } from '@grafana/runtime/unstable';
import { NOTEBOOKS_BASE_URL } from 'app/features/notebook/urls';
import { CONNECTIONS_URL, PROVISIONING_URL } from 'app/features/provisioning/constants';

// Every page path is built here, so the object name is encoded in one place
function page(base: string, suffix = '') {
  return (name: string) => `${base}/${encodeURIComponent(name)}${suffix}`;
}

// Translations hold the label as it reads mid-sentence. A title only uppercases the first letter,
// which is safe in every language. Lowercasing a title is not: German capitalizes every noun, so
// "Ordner" would become the misspelled "ordner". Readers ask for a form here instead of changing
// the case themselves. The label stays a function so that it translates at render, not at module load.
function label(translate: () => string) {
  return ({ upperFirst: upper = true }: KindLabelOptions = {}) => (upper ? upperFirst(translate()) : translate());
}

/**
 * `searchKind` stays out of the `KindInfo` plugins get: only app code turns search hits into these
 * strings, so a plugin never holds one to look up.
 */
interface CoreKindInfo extends KindInfo {
  /** The kind string dashboard search rows carry. That index holds only dashboards and folders. */
  readonly searchKind?: 'dashboard' | 'folder';
}

/**
 * Kinds Grafana serves itself, each described once: what it is called, which icon it gets and where
 * its pages are, so that every list of mixed kinds shows a kind the same way. A feature that needs to
 * know more about a kind, such as how to list it, spreads the kind's row into an entry of its own.
 */
export const CORE_KINDS = {
  folder: {
    group: FOLDER_API_GROUP,
    kind: 'Folder',
    resource: 'folders',
    searchKind: 'folder',
    folderScoped: true,
    getLabel: label(() => t('core-kinds.folder.label', 'folder')),
    getPluralLabel: label(() => t('core-kinds.folder.label-plural', 'folders')),
    icon: 'folder',
    iconColor: 'semi-dark-blue',
    getRoute: page('/dashboards/f'),
  },
  dashboard: {
    group: DASHBOARD_API_GROUP,
    kind: 'Dashboard',
    resource: 'dashboards',
    searchKind: 'dashboard',
    folderScoped: true,
    getLabel: label(() => t('core-kinds.dashboard.label', 'dashboard')),
    getPluralLabel: label(() => t('core-kinds.dashboard.label-plural', 'dashboards')),
    icon: 'apps',
    iconColor: 'semi-dark-orange',
    getRoute: page('/d'),
  },
  notebook: {
    // Also served from the dashboards group, under its own plural
    group: DASHBOARD_API_GROUP,
    kind: 'Notebook',
    resource: 'notebooks',
    // The kind manifest scopes notebooks to folders, but storage refuses the folder annotation until
    // notebooks get folder permissions. Flip this together with `notebookStorageOpts` on the backend.
    folderScoped: false,
    getLabel: label(() => t('core-kinds.notebook.label', 'notebook')),
    getPluralLabel: label(() => t('core-kinds.notebook.label-plural', 'notebooks')),
    icon: 'gf-notebook',
    iconColor: 'semi-dark-purple',
    getRoute: page(NOTEBOOKS_BASE_URL),
  },
  playlist: {
    group: PLAYLIST_API_GROUP,
    kind: 'Playlist',
    resource: 'playlists',
    folderScoped: false,
    getLabel: label(() => t('core-kinds.playlist.label', 'playlist')),
    getPluralLabel: label(() => t('core-kinds.playlist.label-plural', 'playlists')),
    icon: 'presentation-play',
    iconColor: 'semi-dark-yellow',
    // The edit page, not /playlists/play, which starts the fullscreen slideshow at once
    getRoute: page('/playlists/edit'),
  },
  // No `getRoute`: a library panel has no page of its own, only its row on the collection page
  librarypanel: {
    // Served from the dashboards group, under its own plural
    group: DASHBOARD_API_GROUP,
    kind: 'LibraryPanel',
    resource: 'librarypanels',
    // In folders, although the dashboard browser lists them only on each folder's own tab
    folderScoped: true,
    getLabel: label(() => t('core-kinds.librarypanel.label', 'library panel')),
    getPluralLabel: label(() => t('core-kinds.librarypanel.label-plural', 'library panels')),
    icon: 'library-panel',
  },
  repository: {
    group: PROVISIONING_API_GROUP,
    kind: 'Repository',
    resource: 'repositories',
    folderScoped: false,
    getLabel: label(() => t('core-kinds.repository.label', 'repository')),
    getPluralLabel: label(() => t('core-kinds.repository.label-plural', 'repositories')),
    icon: 'code-branch',
    getRoute: page(PROVISIONING_URL),
  },
  connection: {
    group: PROVISIONING_API_GROUP,
    kind: 'Connection',
    resource: 'connections',
    folderScoped: false,
    getLabel: label(() => t('core-kinds.connection.label', 'connection')),
    getPluralLabel: label(() => t('core-kinds.connection.label-plural', 'connections')),
    icon: 'plug',
    getRoute: page(CONNECTIONS_URL, '/edit'),
  },
  datasource: {
    // No API serves this group. Each plugin has its own, like `prometheus.datasource.grafana.app`.
    // The backend still names the kind by this shared ending, so `group` holds it and
    // `collectionGroup` makes it match every plugin's group.
    group: 'datasource.grafana.app',
    collectionGroup: true,
    kind: 'DataSource',
    resource: 'datasources',
    folderScoped: false,
    getLabel: label(() => t('core-kinds.datasource.label', 'data source')),
    getPluralLabel: label(() => t('core-kinds.datasource.label-plural', 'data sources')),
    icon: 'database',
    getRoute: page('/connections/datasources/edit'),
  },
} as const satisfies Record<CoreKindKey, CoreKindInfo>;

const kinds: CoreKindInfo[] = Object.values(CORE_KINDS);
const appKinds = new Map<string, KindInfo>();

/**
 * Whether `group` names this kind: its own group, or for a collection kind a group served inside the
 * collection, which is the group a single object carries.
 */
export function coversGroup(kind: KindInfo, group: string): boolean {
  return kind.group === group || (kind.collectionGroup === true && group.endsWith(`.${kind.group}`));
}

/** Every kind: the ones Grafana serves itself, then the ones app plugins add. */
export function getKinds(): KindInfo[] {
  return [...kinds, ...appKinds.values()];
}

/** The kind an object of this API group and Kubernetes kind belongs to, among core and app kinds. */
export function findKind(group: string, kind: string): KindInfo | undefined {
  return getKinds().find((row) => row.kind === kind && coversGroup(row, group));
}

/** The kind an object of this API group and plural resource name belongs to, among core and app kinds. */
export function findKindByResource(group: string, resource: string): KindInfo | undefined {
  return getKinds().find((row) => row.resource === resource && coversGroup(row, group));
}

/** The group that names an object's kind: the collection's group for a collection member, else `group`. */
export function getKindGroup(group: string, kind: string): string {
  const info = findKind(group, kind);
  return info?.collectionGroup ? info.group : group;
}

/** The kinds that app plugins add. */
export function getAppKinds(): KindInfo[] {
  return [...appKinds.values()];
}

/** Adds the kinds an app plugin serves. A kind that Grafana serves itself keeps its core row. */
export function addKinds(added: KindInfo[]) {
  for (const kind of added) {
    if (!kinds.some((row) => row.kind === kind.kind && coversGroup(row, kind.group))) {
      appKinds.set(`${kind.group}/${kind.kind}`, kind);
    }
  }
}

/** The kind behind a dashboard search row's kind string; undefined for rows such as panels. */
export function findKindBySearchKind(searchKind: string): KindInfo | undefined {
  return kinds.find((row) => row.searchKind === searchKind);
}

/** This table and its lookups as the `KindRegistry` that `@grafana/runtime` defines for plugins. */
export const kindRegistry: KindRegistry = { coreKinds: CORE_KINDS, coversGroup, findKind, getAppKinds, addKinds };
