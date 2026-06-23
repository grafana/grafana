import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { API_GROUP as PLAYLIST_API_GROUP } from '@grafana/api-clients/rtkq/playlist/v1';
import { t } from '@grafana/i18n';
import { type IconName } from '@grafana/ui';
import { type Repository, type SupportedResource } from 'app/api/clients/provisioning/v0alpha1';
import { getIconForKind } from 'app/features/search/service/utils';

import { type ItemType } from '../types';

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
  /** API group, e.g. `dashboard.grafana.app`. */
  group: string;
  /** Kubernetes Kind, e.g. `Dashboard`. */
  kind: string;
  /** Plural resource name as reported by the API (`ResourceListItem.resource`), e.g. `dashboards`. */
  resource: string;
  /** Label shown for this kind in the combined files/resources tree. */
  itemType: ItemType;
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
  /** Localized "N <kind>" count label (handles singular/plural). */
  countLabel: (count: number) => string;
}

// countLabel uses literal `t()` keys per kind so i18n extraction keeps working —
// see useResourceStats for where these counts are surfaced.

/**
 * Registry of provisioning resource kinds, keyed by a stable identifier.
 *
 * `satisfies` checks each entry against ResourceKindInfo without widening the
 * value type, so callers still get the concrete record back.
 */
export const resourceKindInfos = {
  folder: {
    group: FOLDER_API_GROUP,
    kind: 'Folder',
    resource: 'folders',
    itemType: 'Folder',
    icon: getIconForKind('folder'),
    getRoute: (name: string) => `/dashboards/f/${name}`,
    listRoute: '/dashboards',
    folderScoped: true,
    countLabel: (count: number) =>
      t('provisioning.bootstrap-step.folders-count', '', {
        count,
        defaultValue_one: '{{count}} folder',
        defaultValue_other: '{{count}} folders',
      }),
  },
  dashboard: {
    group: DASHBOARD_API_GROUP,
    kind: 'Dashboard',
    resource: 'dashboards',
    itemType: 'Dashboard',
    icon: getIconForKind('dashboard'),
    getRoute: (name: string) => `/d/${name}`,
    listRoute: '/dashboards',
    folderScoped: true,
    countLabel: (count: number) =>
      t('provisioning.bootstrap-step.dashboards-count', '', {
        count,
        defaultValue_one: '{{count}} dashboard',
        defaultValue_other: '{{count}} dashboards',
      }),
  },
  playlist: {
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
    countLabel: (count: number) =>
      t('provisioning.bootstrap-step.playlists-count', '', {
        count,
        defaultValue_one: '{{count}} playlist',
        defaultValue_other: '{{count}} playlists',
      }),
  },
} satisfies Record<string, ResourceKindInfo>;

const allKindInfos: ResourceKindInfo[] = Object.values(resourceKindInfos);

/**
 * Builds the in-app route to view a repository's resources of the given kind.
 * Folder-scoped kinds resolve to the repository's own folder for folder-target
 * repos (and to their collection page otherwise); other kinds always resolve to
 * their collection page.
 */
export function getRepositoryRoute(info: ResourceKindInfo, repo: Repository): string {
  if (info.folderScoped && repo.spec?.sync.target === 'folder') {
    return `/dashboards/f/${repo.metadata?.name}`;
  }
  return info.listRoute;
}

/** Look up a kind by its plural resource name (`ResourceListItem.resource`). */
export function getKindInfoByResource(resource?: string): ResourceKindInfo | undefined {
  return allKindInfos.find((info) => info.resource === resource);
}

/** Look up a kind by its tree item type. */
export function getKindInfoByItemType(itemType: ItemType): ResourceKindInfo | undefined {
  return allKindInfos.find((info) => info.itemType === itemType);
}

/**
 * Look up a kind by a resource-stat group, accepting both the full API group
 * (`folder.grafana.app`) and the legacy short plural (`folders`) that the stats
 * endpoint can return interchangeably.
 */
export function getKindInfoByStatGroup(group?: string): ResourceKindInfo | undefined {
  return allKindInfos.find((info) => info.group === group || info.resource === group);
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
