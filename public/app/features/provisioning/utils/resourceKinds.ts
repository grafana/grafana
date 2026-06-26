import { type UnknownAction } from '@reduxjs/toolkit';

import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { API_GROUP as PLAYLIST_API_GROUP } from '@grafana/api-clients/rtkq/playlist/v1';
import { t } from '@grafana/i18n';
import { type IconName } from '@grafana/ui';
import { playlistAPIv1 } from 'app/api/clients/playlist/v1';
import { type Repository, type SupportedResource } from 'app/api/clients/provisioning/v0alpha1';
import { getIconForKind } from 'app/features/search/service/utils';

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
    group: FOLDER_API_GROUP,
    kind: 'Folder',
    resource: 'folders',
    itemType: 'Folder',
    icon: getIconForKind('folder'),
    getRoute: (name: string) => `/dashboards/f/${name}`,
    listRoute: '/dashboards',
    folderScoped: true,
  },
  dashboard: {
    key: 'dashboard',
    group: DASHBOARD_API_GROUP,
    kind: 'Dashboard',
    resource: 'dashboards',
    itemType: 'Dashboard',
    icon: getIconForKind('dashboard'),
    getRoute: (name: string) => `/d/${name}`,
    listRoute: '/dashboards',
    folderScoped: true,
  },
  playlist: {
    key: 'playlist',
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
    // The playlist list is fetched elsewhere; invalidate it so a committed change shows up there.
    invalidateListTags: () => playlistAPIv1.util.invalidateTags(['Playlist']),
  },
  librarypanel: {
    key: 'librarypanel',
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
  },
} as const;

/**
 * Stable per-kind key identifying a provisioning resource kind across the UI: the commit-message
 * noun, branch-name prefix, telemetry, the shared edit-form fields, and each registry entry's own
 * `key` all use this. Derived from the registry keys, so a new kind only needs its registry entry.
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
 * across switch statements. Adding a new provisioning kind is one {@link resourceKindInfos} entry,
 * plus (if needed) enabling it on the backend so it appears in the settings `availableResources`.
 */
export interface ResourceKindInfo {
  /**
   * Stable lowercase identifier — equals this entry's key in {@link resourceKindInfos} (e.g.
   * `dashboard`). The UI-facing resource type for commit messages, branch prefixes, telemetry and the
   * shared edit-form fields. A test asserts each entry's `key` matches its registry key.
   */
  key: ResourceKindKey;
  /** API group, e.g. `dashboard.grafana.app`. */
  group: string;
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
   * Builds the action that invalidates this kind's list-view cache, dispatched after a successful
   * commit so the change shows up when navigating back to the list. Optional — only kinds whose
   * pages drive {@link SaveProvisionedResourceDrawer} need it. Defining it couples this registry to
   * the kind's RTK Query client (the cost of keeping per-kind invalidation here rather than in a hook).
   */
  invalidateListTags?: () => UnknownAction;
}

// Widening the `as const` registry to ResourceKindInfo[] here also validates every entry against the
// interface — a missing or mis-typed field (e.g. an unknown `icon`) fails at this line rather than at
// each call site. The literal `key`/`itemType` values stay the source of truth for the unions above.
const allKindInfos: ResourceKindInfo[] = Object.values(resourceKindInfos);

/**
 * Localized singular noun for a kind, interpolated into UI copy such as the drawer title (e.g.
 * "Save provisioned {{resource}}"). Kept as a `switch` rather than a registry field because i18n
 * extraction needs literal keys/defaults, so each kind contributes one translated noun here — and
 * the exhaustive switch makes adding a kind a compile error until its noun is provided.
 */
export function getResourceKindLabel(kind: ResourceKindKey): string {
  switch (kind) {
    case 'folder':
      return t('provisioning.resource-kind.folder', 'folder');
    case 'dashboard':
      return t('provisioning.resource-kind.dashboard', 'dashboard');
    case 'playlist':
      return t('provisioning.resource-kind.playlist', 'playlist');
    case 'librarypanel':
      return t('provisioning.resource-kind.library-panel', 'library panel');
  }
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
  return allKindInfos.find((info) => info.group === group || info.resource === group);
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
  return allKindInfos.find((info) => (!group || info.group === group) && (!kind || info.kind === kind));
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
    availableResources.some((r) => r.group === info.group && r.kind === info.kind && !r.disabled)
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
