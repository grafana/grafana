import { type UnknownAction } from '@reduxjs/toolkit';

import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { API_GROUP as PLAYLIST_API_GROUP } from '@grafana/api-clients/rtkq/playlist/v1';
import { API_GROUP as PROVISIONING_API_GROUP } from '@grafana/api-clients/rtkq/provisioning/v0alpha1';
import { t } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { type IconName } from '@grafana/ui';
import { playlistAPIv1 } from 'app/api/clients/playlist/v1';
import { type Repository, type SupportedResource } from 'app/api/clients/provisioning/v0alpha1';
import { getAPIBaseURL } from 'app/api/utils';
import { getAPIGroupDiscoveryList } from 'app/features/apiserver/discovery';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { getIconForKind } from 'app/features/search/service/icons';

import { CONNECTIONS_URL, PROVISIONING_URL } from '../constants';

/**
 * The storage collection every data source plugin's API group is stored in; each plugin serves its
 * own `{plugin}.datasource.grafana.app`.
 */
const DATASOURCE_COLLECTION_GROUP = 'datasource.grafana.app';

/**
 * Registry of provisioning resource kinds, keyed by a stable identifier — the single source of truth
 * the UI reads from instead of scattering per-kind knowledge across switch statements (item types,
 * icons, count labels, resource-ref unions).
 *
 * `as const` preserves the literal field types so the keys ({@link ResourceKindKey}) and tree labels
 * ({@link ResourceItemType}) are derived from this object: adding a kind is ONE entry here (plus, if
 * needed, enabling it on the backend so it appears in the settings endpoint's `availableResources`) —
 * no parallel unions to keep in sync. Entries are validated against {@link ResourceKindInfo} where
 * `allKindInfos` is built below; `as const` is used instead of `satisfies ResourceKindInfo` because
 * the interface references the derived types, which `satisfies` would make a circular reference.
 */
export const resourceKindInfos = {
  folder: {
    key: 'folder',
    getLabel: () => t('provisioning.resource-kind.folder', 'folder'),
    pluralLabel: () => t('provisioning.resource-kind.folders', 'Folders'),
    group: FOLDER_API_GROUP,
    kind: 'Folder',
    resource: 'folders',
    itemType: 'Folder',
    icon: getIconForKind('folder'),
    getRoute: (name: string) => `/dashboards/f/${name}`,
    listRoute: '/dashboards',
    folderScoped: true,
    alwaysAvailable: true,
  },
  dashboard: {
    key: 'dashboard',
    getLabel: () => t('provisioning.resource-kind.dashboard', 'dashboard'),
    pluralLabel: () => t('provisioning.resource-kind.dashboards', 'Dashboards'),
    group: DASHBOARD_API_GROUP,
    kind: 'Dashboard',
    resource: 'dashboards',
    itemType: 'Dashboard',
    icon: getIconForKind('dashboard'),
    getRoute: (name: string) => `/d/${name}`,
    listRoute: '/dashboards',
    folderScoped: true,
    alwaysAvailable: true,
  },
  playlist: {
    key: 'playlist',
    getLabel: () => t('provisioning.resource-kind.playlist', 'playlist'),
    pluralLabel: () => t('provisioning.resource-kind.playlists', 'Playlists'),
    group: PLAYLIST_API_GROUP,
    kind: 'Playlist',
    resource: 'playlists',
    itemType: 'Playlist',
    // The search package's getIconForKind doesn't know playlists, so use the
    // playlist nav icon directly.
    icon: 'presentation-play',
    // Link to the edit page (config + items), not /playlists/play, which would
    // immediately launch the fullscreen slideshow — not a sensible "View" target.
    getRoute: (name: string) => `/playlists/edit/${name}`,
    // Playlists aren't folder-contained — they only have their own collection page.
    listRoute: '/playlists',
    folderScoped: false,
    // Gated on availableResources — not part of the static folder+dashboard base.
    alwaysAvailable: false,
    // The playlist list is fetched elsewhere; invalidate it so a committed change shows up there.
    invalidateListTags: () => playlistAPIv1.util.invalidateTags(['Playlist']),
  },
  librarypanel: {
    key: 'librarypanel',
    getLabel: () => t('provisioning.resource-kind.library-panel', 'library panel'),
    pluralLabel: () => t('provisioning.resource-kind.library-panels', 'Library panels'),
    // Library panels share the dashboards API group but are keyed by their own
    // GroupResource (librarypanels.dashboard.grafana.app).
    group: DASHBOARD_API_GROUP,
    kind: 'LibraryPanel',
    resource: 'librarypanels',
    itemType: 'LibraryPanel',
    // getIconForKind doesn't know library panels, so use the library-panel icon directly.
    icon: 'library-panel',
    // No deep-link route for a single library panel exists; they're only viewable
    // from the library panels collection page.
    listRoute: '/library-panels',
    // Library panels live inside folders on the backend, but the dashboards folder
    // browse doesn't list them — they have their own collection page — so for
    // routing they behave like a non-foldered kind and always resolve to listRoute.
    folderScoped: false,
    alwaysAvailable: false,
  },
  repository: {
    key: 'repository',
    getLabel: () => t('provisioning.resource-kind.repository', 'repository'),
    pluralLabel: () => t('provisioning.resource-kind.repositories', 'Repositories'),
    group: PROVISIONING_API_GROUP,
    kind: 'Repository',
    resource: 'repositories',
    itemType: 'Repository',
    // getIconForKind doesn't know provisioning's own kinds; a repository is a branch of files.
    icon: 'code-branch',
    getRoute: (name: string) => `${PROVISIONING_URL}/${name}`,
    listRoute: PROVISIONING_URL,
    // Repositories are instance-scoped configuration, not folder-contained.
    folderScoped: false,
    alwaysAvailable: false,
  },
  connection: {
    key: 'connection',
    getLabel: () => t('provisioning.resource-kind.connection', 'connection'),
    pluralLabel: () => t('provisioning.resource-kind.connections', 'Connections'),
    group: PROVISIONING_API_GROUP,
    kind: 'Connection',
    resource: 'connections',
    itemType: 'Connection',
    icon: 'plug',
    getRoute: (name: string) => `${CONNECTIONS_URL}/${name}/edit`,
    listRoute: CONNECTIONS_URL,
    folderScoped: false,
    alwaysAvailable: false,
  },
  datasource: {
    key: 'datasource',
    getLabel: () => t('provisioning.resource-kind.datasource', 'data source'),
    pluralLabel: () => t('provisioning.resource-kind.datasources', 'Data sources'),
    // The collection every data source plugin's own group is stored in, not a served group —
    // see `collectionGroup`.
    group: DATASOURCE_COLLECTION_GROUP,
    collectionGroup: true,
    kind: 'DataSource',
    resource: 'datasources',
    itemType: 'DataSource',
    // getIconForKind doesn't know data sources, so use the connections nav icon.
    icon: 'database',
    getRoute: (name: string) => `/connections/datasources/edit/${name}`,
    listRoute: '/connections/datasources',
    // Data sources are org-scoped, not folder-contained.
    folderScoped: false,
    alwaysAvailable: false,
  },
} as const;

/**
 * Stable per-kind key (`folder`, `dashboard`, `playlist`, ...) used to identify a provisioning
 * resource kind across the UI: the commit-message noun, branch-name prefix, telemetry, the shared
 * edit-form fields, and each registry entry's own `key` all use this. Derived from the registry keys,
 * so a new kind only needs its registry entry.
 */
export type ResourceKindKey = keyof typeof resourceKindInfos;

/**
 * Tree-view labels for the provisioning *resource* kinds (`Folder`, `Dashboard`, ...), derived from
 * the registry's `itemType`s so the set stays in lockstep with the kinds above. The full tree
 * {@link ItemType} (these labels plus the `File` fallback) is assembled from this in `../types`, so a
 * new kind needs no edit there either.
 */
export type ResourceItemType = (typeof resourceKindInfos)[ResourceKindKey]['itemType'];

/**
 * Consumer-facing shape of a registry entry. `key`/`itemType` are typed as the derived unions, so a
 * {@link ResourceKindInfo} carries the kind's identity and tree label without a separate lookup.
 *
 * This is the single source of truth the UI reads from instead of scattering per-kind knowledge
 * across switch statements (item types, icons, count labels, resource-ref unions). Adding a new
 * provisioning kind is one {@link resourceKindInfos} entry, plus (if needed)
 * enabling it on the backend so it appears in the settings `availableResources`.
 */
export interface ResourceKindInfo {
  /**
   * Stable lowercase identifier — equals this entry's key in {@link resourceKindInfos} (e.g.
   * `dashboard`). The UI-facing resource type for commit messages, branch prefixes, telemetry and the
   * shared edit-form fields. A test asserts each entry's `key` matches its registry key.
   */
  key: ResourceKindKey;
  /**
   * Returns the localized singular noun for this kind, interpolated into UI copy such as the drawer
   * title (e.g. "Save provisioned {{resource}}"). It's a function rather than a string because i18n
   * must resolve at render time, not at module load — and the literal `t()` call inside it is what
   * the i18n extractor needs, so each kind contributes its translated noun right here on the entry.
   */
  getLabel: () => string;
  /**
   * Translated, pluralized label for this kind (e.g. "Dashboards"), used wherever
   * a kind is named to the user — stat cards, the synthetic per-kind migrate
   * folder, etc. A function so the translation resolves at render, not module load.
   */
  pluralLabel: () => string;
  /** API group, e.g. `dashboard.grafana.app`. */
  group: string;
  /**
   * Whether `group` names a storage collection served by one API group per member rather than a
   * served group itself. Data sources are the case: each plugin serves
   * `{plugin}.datasource.grafana.app`. Such a kind covers any group inside the collection, and is
   * reported to the user as the collection — the plugin that served a resource is not what the
   * kind is called.
   */
  collectionGroup?: boolean;
  /** Kubernetes Kind, e.g. `Dashboard`. */
  kind: string;
  /** Plural resource name as reported by the API (`ResourceListItem.resource`), e.g. `dashboards`. */
  resource: string;
  /** Label shown for this kind in the combined files/resources tree. */
  itemType: ResourceItemType;
  /** Icon shown for this kind in the resource tree. Sourced from the search package's getIconForKind. */
  icon: IconName;
  /** Builds the in-app route to view a single resource of this kind, given its k8s name. */
  getRoute?: (name: string) => string;
  /** The in-app collection page listing all resources of this kind, e.g. `/dashboards`. */
  listRoute: string;
  /**
   * Whether resources of this kind are contained in folders, and so can be scoped
   * to a repository's own folder. Foldered kinds (folders, dashboards) live in the
   * dashboards browse; others (e.g. playlists) only have their `listRoute`.
   */
  folderScoped: boolean;
  /**
   * Whether the kind is in the static provisioning base (folder + dashboard),
   * which the backend always supports. Such kinds are acted on regardless of the
   * settings endpoint's `availableResources`; others are gated on it.
   */
  alwaysAvailable: boolean;
  /**
   * Builds the action that invalidates this kind's list-view cache, dispatched after a successful
   * commit so the change shows up when navigating back to the list. Optional — only kinds whose
   * pages drive `SaveProvisionedResourceDrawer` need it. Defining it couples this registry to the
   * kind's RTK Query client (the cost of keeping per-kind invalidation here rather than in a hook).
   */
  invalidateListTags?: () => UnknownAction;
}

// Widening the `as const` registry to ResourceKindInfo[] here also validates every entry against the
// interface — a missing or mis-typed field (e.g. an unknown `icon`) fails at this line rather than at
// each call site. The literal `key`/`itemType` values stay the source of truth for the unions above.
const allKindInfos: ResourceKindInfo[] = Object.values(resourceKindInfos);

/**
 * Whether `group` identifies this kind. A collection kind also covers the groups served inside the
 * collection, which is what the backend reports for an individual resource and for a job result.
 */
export function coversGroup(info: ResourceKindInfo, group: string): boolean {
  return info.group === group || (Boolean(info.collectionGroup) && group.endsWith(`.${info.group}`));
}

/**
 * The group a kind is named by: the collection rather than the member group that served a given
 * resource, so every member of a collection is reported as one kind.
 */
export function getReportedGroup(group?: string, kind?: string): string | undefined {
  const info = getKindInfoByGroupKind(group, kind);
  return info?.collectionGroup ? info.group : group;
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
  if (info.folderScoped && repo.spec?.sync.target === 'folder' && repoName) {
    // The repository's folder is named after the repo, so reuse the folder kind's
    // route rather than duplicating the `/dashboards/f/...` shape here.
    return resourceKindInfos.folder.getRoute(repoName);
  }
  return info.listRoute;
}

/** Look up a kind by its plural resource name (`ResourceListItem.resource`). */
export function getKindInfoByResource(resource?: string): ResourceKindInfo | undefined {
  return allKindInfos.find((info) => info.resource === resource);
}

/**
 * Look up a kind from a namespace list row, which carries the group its objects are stored under
 * and the plural resource name. Both are needed: kinds can share a group (dashboards and library
 * panels), and a plural name can repeat across groups.
 */
export function getKindInfoByGroupResource(group: string, resource: string): ResourceKindInfo | undefined {
  return allKindInfos.find((info) => info.resource === resource && coversGroup(info, group));
}

/** Row icon for a kind with no registry entry. */
export const DEFAULT_RESOURCE_ICON: IconName = 'file-alt';

/**
 * Look up a kind by its tree item type. Accepts any string (tree items can be the `File` fallback,
 * which has no backing kind and resolves to `undefined`) so callers don't depend on the `ItemType`
 * union and create an import cycle with `../types`.
 */
export function getKindInfoByItemType(itemType: string): ResourceKindInfo | undefined {
  return allKindInfos.find((info) => info.itemType === itemType);
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
 * we fall back to the static base (`alwaysAvailable`, i.e. dashboards) so the
 * common case isn't blank during the initial render.
 */
export function getMigratableKinds(availableResources?: SupportedResource[]): ResourceKindInfo[] {
  return allKindInfos.filter((info) => {
    if (info.kind === resourceKindInfos.folder.kind) {
      return false;
    }
    return availableResources ? isResourceKindAvailable(info, availableResources) : info.alwaysAvailable;
  });
}

// --- Kind resolution ------------------------------------------------------
// What the namespace resource list does not carry: the Kubernetes Kind behind a plural resource
// name, and the group that serves a collection member. Both come from API discovery.

/**
 * A resource's immediate parent folder, as the namespace list reports it. Root-level resources
 * carry an empty folder or the literal "general" UID — normalize both to undefined.
 */
export function readImmediateParent(folder: string | undefined): string | undefined {
  const trimmed = folder?.trim();
  if (!trimmed || trimmed === GENERAL_FOLDER_UID) {
    return undefined;
  }
  return trimmed;
}

/** Key for a `group/resource` pair, so both sides of a lookup spell it the same way. */
export function resourceKeyOf(group: string, resource: string): string {
  return `${group}/${resource}`;
}

/**
 * The Kubernetes Kind each of `pairs` is served as.
 *
 * A migrate job addresses a resource by Kind, while the namespace list reports the plural resource
 * name, so a kind with no registry entry has nowhere else to get it. A pair discovery does not
 * serve is left out of the map.
 */
export async function resolveKindNames(
  pairs: Array<{ group: string; resource: string }>
): Promise<Map<string, string>> {
  const kinds = new Map<string, string>();
  if (pairs.length === 0) {
    return kinds;
  }
  const wanted = new Set(pairs.map(({ group, resource }) => resourceKeyOf(group, resource)));
  const apis = await getAPIGroupDiscoveryList();
  for (const api of apis.items) {
    for (const version of api.versions) {
      for (const served of version.resources) {
        const key = resourceKeyOf(api.metadata.name, served.resource);
        // Versions are listed preferred-first, so the first Kind seen for a pair wins.
        if (wanted.has(key) && !kinds.has(key) && served.responseKind.kind) {
          kinds.set(key, served.responseKind.kind);
        }
      }
    }
  }
  return kinds;
}

interface ApiserverListItem {
  metadata?: { name?: string };
  spec?: { readOnly?: boolean };
}

/** A collection member as its own API group serves it. */
export interface CollectionMember {
  /** The group serving the member, which a migrate job addresses it through. */
  group: string;
  /**
   * Whether the resource rejects writes. Classic file provisioning marks a data source read-only
   * and leaves no manager, so the namespace list reports it unmanaged even though no write can take
   * it over.
   */
  readOnly: boolean;
}

/**
 * Every member of a collection, by resource name.
 *
 * The namespace list keys a collection's members by the group they are stored under, which no API
 * server serves; a migrate job addresses a resource through the group that serves it. Discovery is
 * the source, as it is for the backend's own expansion, because a plugin can be installed without
 * its group being served.
 */
export async function resolveCollectionMembers(
  collection: string,
  resource: string
): Promise<Map<string, CollectionMember>> {
  const apis = await getAPIGroupDiscoveryList();
  const members = apis.items
    .filter((api) => api.metadata.name.endsWith(`.${collection}`))
    .flatMap((api) => {
      // Versions are listed preferred-first.
      const version = api.versions.find((v) => v.resources.some((r) => r.resource === resource));
      return version ? [{ group: api.metadata.name, version: version.version }] : [];
    });

  const perGroup = await Promise.all(
    members.map(async ({ group, version }) => {
      const url = `${getAPIBaseURL(group, version)}/${resource}`;
      const response = await getBackendSrv().get<{ items?: ApiserverListItem[] }>(url);
      return (response.items ?? []).flatMap((item) =>
        item.metadata?.name ? [[item.metadata.name, { group, readOnly: item.spec?.readOnly === true }] as const] : []
      );
    })
  );
  return new Map(perGroup.flat());
}
