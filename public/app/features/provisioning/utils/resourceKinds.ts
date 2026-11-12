import {
  API_GROUP as DASHBOARD_API_GROUP,
  API_VERSION as DASHBOARD_API_VERSION,
} from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { API_GROUP as PLAYLIST_API_GROUP } from '@grafana/api-clients/rtkq/playlist/v1';
import { API_GROUP as PROVISIONING_API_GROUP } from '@grafana/api-clients/rtkq/provisioning/v0alpha1';
import { t } from '@grafana/i18n';
import { type IconName } from '@grafana/ui';
import { type Repository, type SupportedResource } from 'app/api/clients/provisioning/v0alpha1';

import { CONNECTIONS_URL, PROVISIONING_URL } from '../constants';

import {
  type ListedResource,
  type ResourceListDeps,
  listCollectionMembers,
  listPlaylists,
  listViaApiserver,
  listViaSearch,
} from './resourceListing';

/**
 * The storage collection every data source plugin's API group is stored in; each plugin serves its
 * own `{plugin}.datasource.grafana.app`.
 */
const DATASOURCE_COLLECTION_GROUP = 'datasource.grafana.app';

/**
 * How a kind's resources are served, and so how the UI enumerates them. This single fact also
 * decides whether the kind is folder-scoped (only the search index serves parent folders) and
 * whether its `group` is a collection rather than a served group.
 */
export type ResourceSource =
  /** Served by the unified search index, under the kind's registry key as the search kind. */
  | { via: 'search' }
  /** Served by its own apiserver, at the given version. */
  | { via: 'apiserver'; version: string }
  /** Served by one API group per member of the kind's collection `group`. */
  | { via: 'collection' }
  /** Never enumerated: provisioning's own configuration is not content to migrate. */
  | { via: 'none' }
  /** Enumerated by the kind itself, for a kind needing its generated client. */
  | { via: 'custom'; list: (deps: ResourceListDeps) => Promise<ListedResource[]> };

/**
 * Registry of provisioning resource kinds, keyed by a stable identifier — the single source of truth
 * the UI reads from instead of scattering per-kind knowledge across switch statements (icons, count
 * labels, routes, how to enumerate each kind).
 *
 * `as const` preserves the literal field types so the keys ({@link ResourceKindKey}) and tree labels
 * ({@link ResourceItemType}) are derived from this object: adding a kind is ONE entry here (plus, if
 * needed, enabling it on the backend so it appears in the settings endpoint's `availableResources`) —
 * no parallel unions to keep in sync. Entries are validated against {@link ResourceKindInfo} where
 * {@link resourceKindInfos} is built below; `as const` is used instead of `satisfies` because the
 * interface references the derived types, which `satisfies` would make a circular reference.
 */
const kindDefinitions = {
  folder: {
    getLabel: () => t('provisioning.resource-kind.folders', 'Folders'),
    group: FOLDER_API_GROUP,
    kind: 'Folder',
    resource: 'folders',
    icon: 'folder',
    routes: { item: (name: string) => `/dashboards/f/${name}`, list: '/dashboards' },
    source: { via: 'search' },
  },
  dashboard: {
    getLabel: () => t('provisioning.resource-kind.dashboards', 'Dashboards'),
    group: DASHBOARD_API_GROUP,
    kind: 'Dashboard',
    resource: 'dashboards',
    icon: 'apps',
    routes: { item: (name: string) => `/d/${name}`, list: '/dashboards' },
    source: { via: 'search' },
  },
  playlist: {
    getLabel: () => t('provisioning.resource-kind.playlists', 'Playlists'),
    group: PLAYLIST_API_GROUP,
    kind: 'Playlist',
    resource: 'playlists',
    icon: 'presentation-play',
    routes: {
      // The edit page (config + items), not /playlists/play, which would immediately launch the
      // fullscreen slideshow — not a sensible "View" target.
      item: (name: string) => `/playlists/edit/${name}`,
      list: '/playlists',
    },
    // Playlists aren't in the unified search index; list them through their generated apiserver
    // client, which carries the v1→v0alpha1 fallback.
    source: { via: 'custom', list: ({ dispatch }: ResourceListDeps) => listPlaylists(dispatch) },
  },
  librarypanel: {
    getLabel: () => t('provisioning.resource-kind.library-panels', 'Library panels'),
    // Library panels share the dashboards API group but are keyed by their own
    // GroupResource (librarypanels.dashboard.grafana.app).
    group: DASHBOARD_API_GROUP,
    kind: 'LibraryPanel',
    resource: 'librarypanels',
    icon: 'library-panel',
    // No deep-link route for a single library panel exists; they're only viewable from the
    // collection page, which is also why they route like a non-foldered kind despite living in
    // folders on the backend.
    routes: { list: '/library-panels' },
    source: { via: 'apiserver', version: DASHBOARD_API_VERSION },
  },
  repository: {
    getLabel: () => t('provisioning.resource-kind.repositories', 'Repositories'),
    group: PROVISIONING_API_GROUP,
    kind: 'Repository',
    resource: 'repositories',
    // A repository is a branch of files.
    icon: 'code-branch',
    routes: { item: (name: string) => `${PROVISIONING_URL}/${name}`, list: PROVISIONING_URL },
    // Provisioning's own configuration is never a migration target: it is the mechanism that
    // moves resources into a repository, so it is not one of the resources moved.
    source: { via: 'none' },
  },
  connection: {
    getLabel: () => t('provisioning.resource-kind.connections', 'Connections'),
    group: PROVISIONING_API_GROUP,
    kind: 'Connection',
    resource: 'connections',
    icon: 'plug',
    routes: { item: (name: string) => `${CONNECTIONS_URL}/${name}/edit`, list: CONNECTIONS_URL },
    // Not a migration target, for the same reason as repositories.
    source: { via: 'none' },
  },
  datasource: {
    getLabel: () => t('provisioning.resource-kind.datasources', 'Data sources'),
    // The collection every data source plugin's own group is stored in, not a served group —
    // see `isCollectionGroup`.
    group: DATASOURCE_COLLECTION_GROUP,
    kind: 'DataSource',
    resource: 'datasources',
    icon: 'database',
    routes: { item: (name: string) => `/connections/datasources/edit/${name}`, list: '/connections/datasources' },
    source: { via: 'collection' },
  },
} as const;

/**
 * Stable per-kind key (`folder`, `dashboard`, `playlist`, ...) used to identify a provisioning
 * resource kind across the UI: the commit-message noun, branch-name prefix, telemetry, the shared
 * edit-form fields, and the search kind of a search-served kind all use this. Derived from the
 * registry keys, so a new kind only needs its registry entry.
 */
export type ResourceKindKey = keyof typeof kindDefinitions;

/**
 * Tree-view labels for the provisioning *resource* kinds (`Folder`, `Dashboard`, ...) — the
 * Kubernetes Kinds the registry declares, which is what the tree's type column shows. The full tree
 * {@link ItemType} (these labels plus the `File` fallback) is assembled from this in `../types`, so a
 * new kind needs no edit there either.
 */
export type ResourceItemType = (typeof kindDefinitions)[ResourceKindKey]['kind'];

/**
 * Consumer-facing shape of a registry entry. `key`/`kind` are typed as the derived unions, so a
 * {@link ResourceKindInfo} carries the kind's identity and tree label without a separate lookup.
 *
 * This is the single source of truth the UI reads from instead of scattering per-kind knowledge
 * across switch statements. Adding a new provisioning kind is one {@link kindDefinitions} entry,
 * plus (if needed) enabling it on the backend so it appears in the settings `availableResources`.
 */
export interface ResourceKindInfo {
  /**
   * Stable lowercase identifier — the entry's key in {@link kindDefinitions} (e.g. `dashboard`),
   * stamped onto the entry below. The UI-facing resource type for commit messages, branch prefixes,
   * telemetry and the shared edit-form fields.
   */
  key: ResourceKindKey;
  /**
   * Translated collection label (e.g. "Dashboards"), shown wherever a kind is named to the user —
   * stat cards, the synthetic per-kind migrate row. A function because i18n must resolve at render
   * time, not at module load; the literal `t()` call inside it is what the extractor needs, so each
   * kind contributes its translated noun right here on the entry.
   */
  getLabel: () => string;
  /** API group, e.g. `dashboard.grafana.app`. */
  group: string;
  /** Kubernetes Kind, e.g. `Dashboard`. Also the kind's label in the files/resources tree. */
  kind: ResourceItemType;
  /** Plural resource name as reported by the API (`ResourceListItem.resource`), e.g. `dashboards`. */
  resource: string;
  /** Icon shown for this kind in the resource tree. */
  icon: IconName;
  routes: {
    /** Builds the in-app route to view a single resource of this kind, given its k8s name. */
    item?: (name: string) => string;
    /** The in-app collection page listing all resources of this kind, e.g. `/dashboards`. */
    list: string;
  };
  /** How the kind's resources are served — see {@link ResourceSource}. */
  source: ResourceSource;
}

/**
 * The registry entries as the UI consumes them: each definition with its own registry key stamped
 * on, so a kind carries its identity wherever it travels. Widening to {@link ResourceKindInfo} in
 * `allKindInfos` also validates every entry against the interface — a missing or mis-typed field
 * (e.g. an unknown `icon`) fails there rather than at each call site.
 */
// Object.fromEntries erases the per-key types the definitions were written to preserve; the
// assertion restates the mapping it performs, so each entry keeps its own literal shape.
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export const resourceKindInfos = Object.fromEntries(
  Object.entries(kindDefinitions).map(([key, definition]) => [key, { ...definition, key }])
) as { [K in ResourceKindKey]: (typeof kindDefinitions)[K] & { key: K } };

const allKindInfos: ResourceKindInfo[] = Object.values(resourceKindInfos);

/**
 * The static provisioning base the backend always supports, acted on regardless of the settings
 * endpoint's `availableResources`; every other kind is gated on it.
 */
const STATIC_BASE_KINDS: ResourceKindKey[] = ['folder', 'dashboard'];

/**
 * Whether resources of this kind are contained in folders, and so can be scoped to a repository's
 * own folder. True exactly of the search-served kinds: the search index is what reports a parent
 * folder, and the dashboards browse lists what it serves. Library panels do live in folders on the
 * backend but aren't browsable there, so they behave like a non-foldered kind.
 */
export function isFolderScoped(info: ResourceKindInfo): boolean {
  return info.source.via === 'search';
}

/**
 * Whether `group` names a storage collection served by one API group per member rather than a served
 * group itself. Data sources are the case: each plugin serves `{plugin}.datasource.grafana.app`.
 * Such a kind covers any group inside the collection, and is reported to the user as the collection —
 * the plugin that served a resource is not what the kind is called.
 */
function isCollectionGroup(info: ResourceKindInfo): boolean {
  return info.source.via === 'collection';
}

/**
 * Whether `group` identifies this kind. A collection kind also covers the groups served inside the
 * collection, which is what the backend reports for an individual resource and for a job result.
 */
export function coversGroup(info: ResourceKindInfo, group: string): boolean {
  return info.group === group || (isCollectionGroup(info) && group.endsWith(`.${info.group}`));
}

/**
 * The group a kind is named by: the collection rather than the member group that served a given
 * resource, so every member of a collection is reported as one kind.
 */
export function getReportedGroup(group?: string, kind?: string): string | undefined {
  const info = getKindInfoByGroupKind(group, kind);
  return info && isCollectionGroup(info) ? info.group : group;
}

/**
 * Builds the in-app route to view a repository's resources of the given kind.
 * Folder-scoped kinds resolve to the repository's own folder (named after the
 * repository) for folder-target repos; everything else — non-folder targets, a
 * repo missing its name, or non-folder-scoped kinds — resolves to the kind's
 * collection page.
 */
export function getRepositoryRoute(info: ResourceKindInfo, repo: Repository): string {
  const repoName = repo.metadata?.name;
  if (isFolderScoped(info) && repo.spec?.sync.target === 'folder' && repoName) {
    // The repository's folder is named after the repo, so reuse the folder kind's
    // route rather than duplicating the `/dashboards/f/...` shape here.
    return resourceKindInfos.folder.routes.item(repoName);
  }
  return info.routes.list;
}

/** Look up a kind by its plural resource name (`ResourceListItem.resource`). */
export function getKindInfoByResource(resource?: string): ResourceKindInfo | undefined {
  return allKindInfos.find((info) => info.resource === resource);
}

/**
 * Look up a kind by its tree item type. Accepts any string (tree items can be the `File` fallback,
 * which has no backing kind and resolves to `undefined`) so callers don't depend on the `ItemType`
 * union and create an import cycle with `../types`.
 */
export function getKindInfoByItemType(itemType: string): ResourceKindInfo | undefined {
  return allKindInfos.find((info) => info.kind === itemType);
}

/**
 * Look up a kind by a resource-stat group, accepting both the full API group
 * (`folder.grafana.app`) and the legacy short plural (`folders`) that the stats
 * endpoint can return interchangeably.
 *
 * Prefer `getKindInfoByStat` when a `resource` is available: several kinds can
 * share an API group, so the group alone does not always identify the kind.
 */
export function getKindInfoByStatGroup(group?: string): ResourceKindInfo | undefined {
  return allKindInfos.find((info) => (group !== undefined && coversGroup(info, group)) || info.resource === group);
}

/**
 * Look up a kind from a job summary row, which carries both the API group
 * (`dashboard.grafana.app`) and the Kubernetes Kind (`Dashboard`). Matches on
 * whichever identifiers are present so partially-populated summary rows still resolve.
 */
export function getKindInfoByGroupKind(group?: string, kind?: string): ResourceKindInfo | undefined {
  if (!group && !kind) {
    return undefined;
  }
  return allKindInfos.find((info) => (!group || coversGroup(info, group)) && (!kind || info.kind === kind));
}

/**
 * Look up a kind from a resource-stat entry (`ResourceCount`), which carries both
 * an API `group` and a plural `resource` name. The plural resource uniquely
 * identifies the kind even when kinds share a group, so we match on it first and
 * fall back to a group-only match for stats that omit the resource.
 */
export function getKindInfoByStat(stat: { group?: string; resource?: string }): ResourceKindInfo | undefined {
  const byResource = allKindInfos.find((info) => info.resource === stat.resource);
  if (byResource) {
    return byResource;
  }
  return getKindInfoByStatGroup(stat.group);
}

/**
 * Resolves which kinds the backend currently exposes for provisioning, gating on
 * the config-derived `availableResources` from the settings endpoint. Disabled
 * kinds (declared but not acted on) are excluded.
 *
 * When `availableResources` is unset (e.g. settings not loaded yet) we fall back
 * to the full registry as a best-effort default — this can include kinds the
 * backend currently ships disabled (e.g. playlists), so callers that must respect
 * the disabled state should wait for `availableResources` to be populated.
 */
export function getAvailableResourceKinds(availableResources?: SupportedResource[]): ResourceKindInfo[] {
  if (!availableResources) {
    return allKindInfos;
  }
  return allKindInfos.filter((info) =>
    availableResources.some(
      (r) => r.group !== undefined && coversGroup(info, r.group) && r.kind === info.kind && !r.disabled
    )
  );
}

/** Whether a given kind is currently enabled for provisioning per the settings endpoint. */
export function isResourceKindAvailable(info: ResourceKindInfo, availableResources?: SupportedResource[]): boolean {
  // Compare on group/kind rather than object identity so callers can pass an
  // equivalent descriptor that isn't the exact registry instance.
  return getAvailableResourceKinds(availableResources).some(
    (available) => available.group === info.group && available.kind === info.kind
  );
}

/**
 * The kinds offered for migration on this instance: every registered kind except
 * folders (the container others nest under).
 *
 * Once `availableResources` is loaded the backend is authoritative for every
 * kind: only kinds it reports active are returned, so an overridden
 * `[provisioning] resources` config that omits or disables a kind (even
 * dashboards) is honored. Before settings load (`availableResources` undefined)
 * we fall back to the static base (dashboards) so the common case isn't blank
 * during the initial render.
 */
export function getMigratableKinds(availableResources?: SupportedResource[]): ResourceKindInfo[] {
  return allKindInfos.filter((info) => {
    if (info.kind === resourceKindInfos.folder.kind) {
      return false;
    }
    return availableResources
      ? isResourceKindAvailable(info, availableResources)
      : STATIC_BASE_KINDS.includes(info.key);
  });
}

/**
 * Enumerates every resource of this kind on the instance, per the kind's {@link ResourceSource}, so
 * callers iterate kinds generically without knowing where each one is served from.
 */
export function listResources(info: ResourceKindInfo, deps: ResourceListDeps): Promise<ListedResource[]> {
  switch (info.source.via) {
    case 'search':
      return listViaSearch(info.key);
    case 'apiserver':
      return listViaApiserver(info.group, info.source.version, info.resource);
    case 'collection':
      return listCollectionMembers(info.group, info.resource, info.kind, deps.availableResources);
    case 'none':
      return Promise.resolve([]);
    case 'custom':
      return info.source.list(deps);
  }
}
