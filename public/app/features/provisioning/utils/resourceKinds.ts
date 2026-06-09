import { type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type RepositorySpec } from 'app/api/clients/provisioning/v0alpha1';

type SyncTarget = RepositorySpec['sync']['target'];

interface ResourceListContext {
  /** Repository name, used to build folder-scoped routes. */
  repoName?: string;
  /** Where the repository syncs its resources. */
  syncTarget?: SyncTarget;
}

export interface ResourceKindDescriptor {
  /** API group, e.g. `dashboard.grafana.app`. */
  group: string;
  /** Plural resource name as reported in repository stats, e.g. `dashboards`. */
  resource: string;
  /** Icon shown next to the kind in listings and the resource table. */
  icon: IconName;
  /** Localized, human-friendly plural label, e.g. "Dashboards". */
  getLabel: () => string;
  /** In-app route listing resources of this kind for the given repository. */
  getListUrl: (ctx: ResourceListContext) => string;
}

// Folder- and dashboard-scoped kinds live under a repository's folder when the
// repo syncs to a folder, otherwise under the global dashboards list. Unknown
// kinds reuse this as the graceful fallback, matching prior behavior.
function folderScopedListUrl({ repoName, syncTarget }: ResourceListContext): string {
  if (syncTarget === 'folder' && repoName) {
    return `/dashboards/f/${repoName}`;
  }
  return '/dashboards';
}

// The single source of per-kind presentation knowledge for repository stats.
// Adding a new provisioned resource type is one entry here; the listing and
// overview render it with no further edits.
const RESOURCE_KINDS: ResourceKindDescriptor[] = [
  {
    group: 'folder.grafana.app',
    resource: 'folders',
    icon: 'folder',
    getLabel: () => t('provisioning.resource-kind.folders', 'Folders'),
    getListUrl: folderScopedListUrl,
  },
  {
    group: 'dashboard.grafana.app',
    resource: 'dashboards',
    icon: 'apps',
    getLabel: () => t('provisioning.resource-kind.dashboards', 'Dashboards'),
    getListUrl: folderScopedListUrl,
  },
  {
    group: 'playlist.grafana.app',
    resource: 'playlists',
    icon: 'presentation-play',
    getLabel: () => t('provisioning.resource-kind.playlists', 'Playlists'),
    getListUrl: () => '/playlists',
  },
];

/**
 * Resolve the descriptor for a repository stat entry. Stats are keyed on
 * group+resource, but `resource` is the discriminator since the API group is
 * not unique across kinds. Falls back to a group-only match so a stat that
 * carries only one of the two still resolves. Returns undefined for unknown
 * kinds — callers fall back gracefully.
 */
export function resolveResourceKind(group?: string, resource?: string): ResourceKindDescriptor | undefined {
  if (resource) {
    const byResource = RESOURCE_KINDS.filter((kind) => kind.resource === resource);
    if (byResource.length === 1) {
      return byResource[0];
    }
    if (byResource.length > 1) {
      return byResource.find((kind) => kind.group === group) ?? byResource[0];
    }
  }
  if (group) {
    return RESOURCE_KINDS.find((kind) => kind.group === group);
  }
  return undefined;
}

const DEFAULT_RESOURCE_ICON: IconName = 'apps';

/** Friendly plural label for a stat's kind; falls back to the raw resource name. */
export function getResourceLabel(group?: string, resource?: string): string {
  return resolveResourceKind(group, resource)?.getLabel() ?? resource ?? '';
}

/** Icon for a stat's kind; falls back to a generic resource icon. */
export function getResourceIcon(group?: string, resource?: string): IconName {
  return resolveResourceKind(group, resource)?.icon ?? DEFAULT_RESOURCE_ICON;
}

/** In-app listing route for a stat's kind, with a folder/dashboards fallback for unknown kinds. */
export function getResourceListUrl(
  group: string | undefined,
  resource: string | undefined,
  ctx: ResourceListContext
): string {
  return (resolveResourceKind(group, resource) ?? { getListUrl: folderScopedListUrl }).getListUrl(ctx);
}
