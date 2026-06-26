import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { API_GROUP as PLAYLIST_API_GROUP } from '@grafana/api-clients/rtkq/playlist/v1';
import { type IconName } from '@grafana/ui';
import { type Repository, type SupportedResource } from 'app/api/clients/provisioning/v0alpha1';
import { getIconForKind } from 'app/features/search/service/utils';

/**
 * Tree-view labels for the provisioning *resource* kinds — the single source of truth for them.
 * Each {@link resourceKindInfos} entry's `itemType` is checked against this union (so a typo is a
 * compile error), and the full tree {@link ItemType} (these labels plus the `File` fallback) is
 * assembled from it in `../types`. Adding a kind means adding its label here next to its registry
 * entry — but no edit to `../types`.
 */
export type ResourceItemType = 'Folder' | 'Dashboard' | 'Playlist' | 'LibraryPanel';

/**
 * Stable per-kind key identifying a provisioning resource kind across the UI: the commit-message
 * noun, branch-name prefix, telemetry, the shared edit-form fields, and each registry entry's own
 * `key` all use this. The registry below is declared `satisfies Record<ResourceKindKey,
 * ResourceKindInfo>`, so this union and {@link resourceKindInfos} stay mutually exhaustive — adding a
 * kind needs a member here and a matching entry, or it won't compile. (Explicit rather than `keyof
 * typeof resourceKindInfos` because entries reference it via `key`, which `keyof` would make circular.)
 */
export type ResourceKindKey = 'folder' | 'dashboard' | 'playlist' | 'librarypanel';

/**
 * Per-kind UI metadata for provisioning resources.
 *
 * This is the single source of truth the UI reads from instead of scattering
 * per-kind knowledge across switch statements (item types, icons, count labels,
 * resource-ref unions). Adding a new provisioning kind should be one entry here
 * plus, if needed, enabling it on the backend so it appears in the settings
 * endpoint's `availableResources`.
 */
export interface ResourceKindInfo {
  /**
   * Stable lowercase identifier — the same value as this entry's key in {@link resourceKindInfos}
   * (e.g. `dashboard`). It's the UI-facing resource type for commit messages, branch prefixes,
   * telemetry and the shared edit-form fields, so passing a descriptor carries its own type. A test
   * asserts each entry's `key` matches its registry key.
   */
  key: ResourceKindKey;
  /** Human-readable singular noun for this kind, shown in UI copy such as drawer titles. */
  displayName: string;
  /** API group, e.g. `dashboard.grafana.app`. */
  group: string;
  /** Kubernetes Kind, e.g. `Dashboard`. */
  kind: string;
  /** Plural resource name as reported by the API (`ResourceListItem.resource`), e.g. `dashboards`. */
  resource: string;
  /**
   * Label shown for this kind in the combined files/resources tree. Constrained to
   * {@link ResourceItemType} so a wrong label is a compile error; the full tree {@link ItemType}
   * (in `../types`) is `ResourceItemType | 'File'`, so adding a kind needs no edit to that file.
   */
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
}

/**
 * Registry of provisioning resource kinds, keyed by a stable identifier.
 *
 * `satisfies` checks each entry against ResourceKindInfo without widening the
 * value type, so callers still get the concrete record back.
 */
export const resourceKindInfos = {
  folder: {
    key: 'folder',
    displayName: 'folder',
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
    displayName: 'dashboard',
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
    displayName: 'playlist',
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
  },
  librarypanel: {
    key: 'librarypanel',
    displayName: 'library panel',
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
} satisfies Record<ResourceKindKey, ResourceKindInfo>;

const allKindInfos: ResourceKindInfo[] = Object.values(resourceKindInfos);

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
