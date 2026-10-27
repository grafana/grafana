import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { type AppPluginConfig, type IconName, locationUtil, type PluginStarredKind } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getFolderURL, starredFoldersEnabled } from 'app/features/browse-dashboards/utils/dashboards';

/**
 * A kind whose objects people can star. The Stars resource stores names per API group and kind;
 * this describes how Grafana shows those names and where it finds their titles. Dashboards and
 * folders are built in; app plugins declare their own kinds in plugin.json (`starredKinds`).
 */
export interface StarredKind {
  group: string;
  kind: string;
  /** The kind string search rows and nav leaves carry: `dashboard`, `folder`, or `group/Kind` for a plugin kind. */
  searchKind: string;
  /** Singular display name. */
  title: string;
  icon: IconName;
  /** Starred lists group kinds by this rank, alphabetical within a rank: dashboards, folders, then plugin kinds. */
  sortWeight: number;
  /**
   * The app plugin that declared the kind; Grafana's own kinds have none. A plugin's objects
   * resolve through the kind's own search endpoint rather than the dashboard search index, and
   * belong to the plugin, so the browse views never move or delete them.
   */
  pluginId?: string;
  url(name: string): string;
}

const PLUGIN_KIND_FIRST_SORT_WEIGHT = 2;

/** Nav Starred entry (url + icon + sort rank + kind) for one starred object. */
export interface StarredNavEntry {
  url: string;
  icon?: IconName;
  sortWeight: number;
  kind: string;
}

function dashboardKind(): StarredKind {
  return {
    group: DASHBOARD_API_GROUP,
    kind: 'Dashboard',
    searchKind: 'dashboard',
    title: t('stars.kinds.dashboard', 'Dashboard'),
    icon: 'apps',
    sortWeight: 0,
    url: (name) => locationUtil.assureBaseUrl(`/d/${name}`),
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
    url: getFolderURL,
  };
}

function pluginKind(pluginId: string, declared: PluginStarredKind, sortWeight: number): StarredKind {
  return {
    group: declared.group,
    kind: declared.kind,
    searchKind: `${declared.group}/${declared.kind}`,
    title: declared.title,
    icon: declared.icon,
    sortWeight,
    pluginId,
    // The validated path always holds the placeholder
    url: (name) => locationUtil.assureBaseUrl(declared.path.replace('{name}', encodeURIComponent(name))),
  };
}

// Filled once at startup from the app plugin metas; a plugin's declaration cannot change within a page load.
let pluginKinds: StarredKind[] = [];

/** Registers the kinds the installed app plugins declare, in declaration order. */
export function initStarredKinds(apps: AppPluginConfig[]): void {
  const declared = apps.flatMap((app) => (app.starredKinds ?? []).map((kind) => ({ pluginId: app.id, kind })));
  pluginKinds = declared.map(({ pluginId, kind }, index) =>
    pluginKind(pluginId, kind, PLUGIN_KIND_FIRST_SORT_WEIGHT + index)
  );
}

/** Grafana's own kinds, then the plugin-declared ones. */
export function getStarredKinds(): StarredKind[] {
  const kinds = [dashboardKind()];
  if (starredFoldersEnabled()) {
    kinds.push(folderKind());
  }
  return [...kinds, ...pluginKinds];
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
    kind: starredKind.searchKind,
  };
}
