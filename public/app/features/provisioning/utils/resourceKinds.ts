import { t } from '@grafana/i18n';
import { type IconName } from '@grafana/ui';

import { type ItemType } from '../types';

/**
 * Context required to build an in-app listing URL for a resource kind.
 */
export interface ResourceRouteContext {
  /** k8s name of the repository the resources belong to */
  repoName: string;
  /** Where the repository syncs resources */
  syncTarget?: 'folder' | 'instance';
}

/**
 * Per-kind UI metadata. This is the single source of truth the provisioning UI
 * reads from when it needs to know how to label, route to, count or icon a
 * resource kind. Adding support for a new provisioned resource type should only
 * require appending one entry to {@link RESOURCE_KINDS} (and — if it appears in
 * the file tree — a member on {@link ItemType}).
 *
 * There is intentionally no feature-toggle field: the backend is the source of
 * truth for which kinds are provisioned, so the UI simply renders whatever the
 * stats/resources APIs report and resolves it through this registry.
 */
export interface ResourceKindDescriptor {
  /** API group, e.g. 'dashboard.grafana.app'. Not unique — dashboards and library panels share one. */
  group: string;
  /** Plural resource name as used by the API, e.g. 'dashboards'. Unique across kinds. */
  resource: string;
  /**
   * Singular k8s Kind. Used in bulk-action resource references and as the resource
   * tree node's {@link ItemType} (e.g. 'Folder', 'Dashboard', 'LibraryPanel').
   */
  kind: string;
  /** Icon used in listings and the resource tree */
  icon: IconName;
  /** Localized plural label, e.g. "Dashboards". */
  getLabel: () => string;
  /** Builds the in-app listing URL for this kind. */
  getListUrl: (ctx: ResourceRouteContext) => string;
  /**
   * Builds the in-app URL to view a single resource of this kind by its k8s name.
   * Omitted for kinds without a per-resource detail page (e.g. library panels).
   */
  getViewUrl?: (name: string) => string;
}

// Dashboards, folders and library panels all live in the repository folder
// (folder target) or the global dashboards listing (instance target).
function folderContainedListUrl({ repoName, syncTarget }: ResourceRouteContext): string {
  return syncTarget === 'folder' ? `/dashboards/f/${repoName}` : '/dashboards';
}

// Order matters: when only a (non-unique) group is known, the first matching kind
// is treated as that group's primary kind — see resolveResourceKind.
export const RESOURCE_KINDS: ResourceKindDescriptor[] = [
  {
    group: 'folder.grafana.app',
    resource: 'folders',
    kind: 'Folder',
    icon: 'folder',
    getLabel: () => t('provisioning.resource-kind.folders', 'Folders'),
    getListUrl: folderContainedListUrl,
    getViewUrl: (name) => `/dashboards/f/${name}`,
  },
  {
    group: 'dashboard.grafana.app',
    resource: 'dashboards',
    kind: 'Dashboard',
    icon: 'apps',
    getLabel: () => t('provisioning.resource-kind.dashboards', 'Dashboards'),
    getListUrl: folderContainedListUrl,
    getViewUrl: (name) => `/d/${name}`,
  },
  {
    // Library panels share the dashboard API group but are a distinct resource.
    group: 'dashboard.grafana.app',
    resource: 'librarypanels',
    kind: 'LibraryPanel',
    icon: 'library-panel',
    getLabel: () => t('provisioning.resource-kind.library-panels', 'Library panels'),
    getListUrl: () => '/library-panels',
  },
  {
    group: 'playlist.grafana.app',
    resource: 'playlists',
    kind: 'Playlist',
    icon: 'presentation-play',
    getLabel: () => t('provisioning.resource-kind.playlists', 'Playlists'),
    getListUrl: () => '/playlists',
  },
];

/**
 * Strict lookup by both API group and plural resource. Use this when the caller
 * has a fully-qualified resource (e.g. a tree node's resource), so that the
 * shared `dashboard.grafana.app` group never misclassifies dashboards vs library panels.
 */
export function findResourceKind(group?: string, resource?: string): ResourceKindDescriptor | undefined {
  if (!group || !resource) {
    return undefined;
  }
  return RESOURCE_KINDS.find((kind) => kind.group === group && kind.resource === resource);
}

/**
 * Lenient lookup for stats, which may carry the full group, only the group, or
 * (for legacy payloads) the plural resource in the `group` field. Prefers an exact
 * group+resource match, then the (unique) resource alone, then the group token —
 * the group token resolves to that group's primary (first-declared) kind, since a
 * group is not unique.
 */
export function resolveResourceKind(group?: string, resource?: string): ResourceKindDescriptor | undefined {
  return (
    findResourceKind(group, resource) ??
    (resource ? RESOURCE_KINDS.find((kind) => kind.resource === resource) : undefined) ??
    (group ? RESOURCE_KINDS.find((kind) => kind.group === group || kind.resource === group) : undefined)
  );
}

/** Lookup by singular k8s Kind, used when building bulk-action resource references. */
export function getResourceKindByKind(kind: string): ResourceKindDescriptor | undefined {
  return RESOURCE_KINDS.find((descriptor) => descriptor.kind === kind);
}

/** True when the tree item type is a resource kind (not the structural 'File'). */
export function isResourceItemType(itemType: ItemType): boolean {
  return RESOURCE_KINDS.some((descriptor) => descriptor.kind === itemType);
}

/** Listing URL for a stat's kind, with a graceful fallback for unknown kinds. */
export function getResourceListUrl(
  group: string | undefined,
  resource: string | undefined,
  ctx: ResourceRouteContext
): string {
  return (resolveResourceKind(group, resource) ?? FALLBACK_KIND).getListUrl(ctx);
}

/** In-app URL to view a single resource by its tree item type (kind), or undefined when there is no detail page. */
export function getResourceViewUrl(itemType: ItemType, name: string): string | undefined {
  return getResourceKindByKind(itemType)?.getViewUrl?.(name);
}

/** Localized plural label for a stat's kind, falling back to the raw resource string. */
export function getResourceLabel(group?: string, resource?: string): string {
  const descriptor = resolveResourceKind(group, resource);
  return descriptor ? descriptor.getLabel() : (resource ?? group ?? '');
}

/**
 * "{count} {label}" label for migration stats (e.g. "5 Dashboards"). Composed in
 * code from the count and the descriptor's already-localized label, so no kind
 * noun is interpolated into a translation string.
 */
export function getResourceCountLabel(descriptor: ResourceKindDescriptor, count: number): string {
  return `${count} ${descriptor.getLabel()}`;
}

/** Icon for a stat's kind, falling back to a generic file icon. */
export function getResourceIcon(group?: string, resource?: string): IconName {
  return resolveResourceKind(group, resource)?.icon ?? FALLBACK_KIND.icon;
}

// Used when a kind cannot be resolved: route like a folder-contained resource and
// render a generic icon, so unknown kinds degrade gracefully instead of breaking.
const FALLBACK_KIND: Pick<ResourceKindDescriptor, 'icon' | 'getListUrl'> = {
  icon: 'file-alt',
  getListUrl: folderContainedListUrl,
};
