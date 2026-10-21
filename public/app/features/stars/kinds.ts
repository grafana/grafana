import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { type IconName, locationUtil, type PluginStarredKind } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { getAppPluginMetas } from '@grafana/runtime/internal';
import { getFolderURL, starredFoldersEnabled } from 'app/features/browse-dashboards/utils/dashboards';

/**
 * A kind whose objects people can star. The Stars resource stores names per API group and kind;
 * this describes how Grafana shows those names and where it finds their titles. Dashboards and
 * folders are built in; app plugins declare their own kinds in plugin.json (`starredKinds`).
 */
export interface StarredKind {
  group: string;
  kind: string;
  /** The kind string search rows carry: `dashboard`, `folder`, or `group/Kind` for a plugin kind. */
  searchKind: string;
  /** Singular display name. */
  title: string;
  icon: IconName;
  /** Starred lists group kinds by this rank, alphabetical within a rank: dashboards, folders, then plugin kinds. */
  sortWeight: number;
  /** Where titles and folders come from: the dashboard search index, or the kind's own search endpoint. */
  source: 'dashboard-search' | 'kind-search';
  /** Whether the browse views may move or delete objects of the kind; only Grafana's own kinds. */
  editable: boolean;
  url(name: string): string;
  /** Whether a link points at an object of the kind; used where only the link survives, e.g. nav analytics. */
  matchesUrl(url: string): boolean;
}

const PLUGIN_KIND_FIRST_SORT_WEIGHT = 2;

/** Nav Starred entry (url + icon + sort rank) for one starred object. */
export interface StarredNavEntry {
  url: string;
  icon?: IconName;
  sortWeight: number;
}

function dashboardKind(): StarredKind {
  return {
    group: DASHBOARD_API_GROUP,
    kind: 'Dashboard',
    searchKind: 'dashboard',
    title: t('stars.kinds.dashboard', 'Dashboard'),
    icon: 'apps',
    sortWeight: 0,
    source: 'dashboard-search',
    editable: true,
    url: (name) => locationUtil.assureBaseUrl(`/d/${name}`),
    matchesUrl: (url) => url.includes('/d/'),
  };
}

function folderKind(): StarredKind {
  return {
    group: FOLDER_API_GROUP,
    kind: 'Folder',
    searchKind: 'folder',
    title: t('stars.kinds.folder', 'Folder'),
    icon: 'folder',
    sortWeight: 1,
    source: 'dashboard-search',
    editable: true,
    url: getFolderURL,
    matchesUrl: (url) => url.includes('/dashboards/f/'),
  };
}

function pluginKind(declared: PluginStarredKind, sortWeight: number): StarredKind {
  // The validated path always holds the placeholder; the prefix before it identifies the kind's links.
  const pathPrefix = declared.path.slice(0, declared.path.indexOf('{name}'));
  return {
    group: declared.group,
    kind: declared.kind,
    searchKind: `${declared.group}/${declared.kind}`,
    title: declared.title,
    icon: declared.icon,
    sortWeight,
    source: 'kind-search',
    editable: false,
    url: (name) => `${config.appSubUrl}${declared.path.replace('{name}', encodeURIComponent(name))}`,
    matchesUrl: (url) => url.includes(pathPrefix),
  };
}

// Kinds declared by installed app plugins, as last loaded. The async load runs before any
// starred list resolves, so the synchronous readers below see the declared kinds.
let pluginDeclaredKinds: PluginStarredKind[] = [];

/** Grafana's own kinds plus the plugin-declared ones loaded so far; see loadStarredKinds. */
export function getStarredKinds(): StarredKind[] {
  const kinds = [dashboardKind()];
  if (starredFoldersEnabled()) {
    kinds.push(folderKind());
  }
  pluginDeclaredKinds.forEach((declared, index) => {
    kinds.push(pluginKind(declared, PLUGIN_KIND_FIRST_SORT_WEIGHT + index));
  });
  return kinds;
}

/** Reads the kinds installed app plugins declare, then returns every kind. */
export async function loadStarredKinds(): Promise<StarredKind[]> {
  const apps = await getAppPluginMetas();
  pluginDeclaredKinds = apps.flatMap((app) => app.starredKinds ?? []);
  return getStarredKinds();
}

export function findStarredKind(group: string, kind: string): StarredKind | undefined {
  return getStarredKinds().find((candidate) => candidate.group === group && candidate.kind === kind);
}

/** The kind behind a search row's kind string; undefined for rows nobody can star, such as panels. */
export function findStarredKindBySearchKind(searchKind: string): StarredKind | undefined {
  return getStarredKinds().find((candidate) => candidate.searchKind === searchKind);
}

/** Whether starred lists need a kind icon per row: only when more than one kind can appear. */
export function starredKindsNeedIcons(): boolean {
  return getStarredKinds().length > 1;
}

export function starredNavEntry(starredKind: StarredKind, id: string): StarredNavEntry {
  return {
    url: starredKind.url(id),
    icon: starredKindsNeedIcons() ? starredKind.icon : undefined,
    sortWeight: starredKind.sortWeight,
  };
}

/** The kind a starred link points at, falling back to dashboards, whose links have no distinctive prefix. */
export function starredKindForUrl(url: string): StarredKind {
  const kinds = getStarredKinds();
  return kinds.find((candidate) => candidate.searchKind !== 'dashboard' && candidate.matchesUrl(url)) ?? kinds[0];
}
