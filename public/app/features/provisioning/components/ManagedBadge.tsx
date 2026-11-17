import { textUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Badge, type BadgeColor, Dropdown, IconButton, type IconName, Menu, Stack, Text } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { ManagerKind } from 'app/features/apiserver/types';
import { AccessControlAction } from 'app/types/accessControl';

import { PROVISIONING_URL } from '../constants';
import { RepoViewStatus, useGetResourceRepositoryView } from '../hooks/useGetResourceRepositoryView';
import { getRepoFileUrl } from '../utils/git';
import { getRepositoryTypeConfig } from '../utils/repositoryTypes';
import { getManagedByRepositoryTooltip, getOrphanedRepositoryTooltip } from '../utils/tooltip';

import { splitSourcePath } from './utils/path';

interface ManagedBadgeProps {
  /** Which system manages the resource. When omitted, a generic "Provisioned" badge is shown. */
  managerKind?: ManagerKind;
  /** Repository title/name or plugin id, shown in the tooltip where relevant. */
  name?: string;
  /** Repository-managed resource whose backing repository no longer exists. */
  isOrphaned?: boolean;
  isReadOnly?: boolean;
  /**
   * Manager identity (`grafana.app/managerId`). When set for a repository-managed resource, a
   * menu button next to the badge exposes permission-gated actions (source file, repository admin).
   */
  repositoryName?: string;
  /**
   * Path of the resource's source file within the repository (`grafana.app/sourcePath`).
   * May carry a `#ref` fragment (provisioning previews); the source link then targets that ref.
   */
  sourcePath?: string;
}

/**
 * Badge indicating that a resource is managed by an external system. It renders the repository
 * (git) style used across folder, dashboard and playlist pages, the terraform/kubectl/plugin
 * variants, the orphaned-repository state (`isOrphaned`), and a generic "Provisioned" fallback when
 * `managerKind` is omitted/unknown. Use it for any resource that `getManagerKind`/`isManaged`
 * reports as managed so the styling stays consistent.
 *
 * When `repositoryName` is provided for a repository-managed resource, a menu button next to the
 * badge lists the available actions: a link to the resource's source file in the
 * git provider (Editors/Admins, when `sourcePath` resolves to a browsable URL) and a link to the
 * repository administration page (repository managers with `provisioning.repositories:write`).
 * Users without any available action (e.g. Viewers) get the badge alone.
 */
export function ManagedBadge({
  managerKind,
  name,
  isOrphaned = false,
  isReadOnly = false,
  repositoryName,
  sourcePath,
}: ManagedBadgeProps) {
  // The interactive variant is a separate component so the RTK Query hook only runs (and only
  // requires a store context) when a repository lookup can actually yield actions.
  if (config.provisioningEnabled && managerKind === ManagerKind.Repo && repositoryName && !isOrphaned) {
    return (
      <RepoManagedBadge name={name} isReadOnly={isReadOnly} repositoryName={repositoryName} sourcePath={sourcePath} />
    );
  }

  return <StaticManagedBadge managerKind={managerKind} name={name} isOrphaned={isOrphaned} isReadOnly={isReadOnly} />;
}

/** Plain, non-interactive badge with a hover tooltip. */
function StaticManagedBadge({ managerKind, name, isOrphaned = false, isReadOnly }: ManagedBadgeProps) {
  const { color, icon, tooltip } = getBadgeDisplay({ managerKind, name, isOrphaned, isReadOnly });
  return <Badge color={color} icon={icon} tooltip={tooltip} />;
}

interface RepoManagedBadgeProps {
  name?: string;
  isReadOnly: boolean;
  repositoryName: string;
  sourcePath?: string;
}

/**
 * Repository-managed variant: resolves the repository view (viewer-safe endpoint) and, when the
 * user has any permitted action, renders a menu button next to the badge.
 */
function RepoManagedBadge({ name, isReadOnly, repositoryName, sourcePath }: RepoManagedBadgeProps) {
  const { repository, status } = useGetResourceRepositoryView({ name: repositoryName });

  const isOrphaned = status === RepoViewStatus.Orphaned;
  const displayName = repository?.title || name || repositoryName;
  const { color, icon, tooltip } = getBadgeDisplay({
    managerKind: ManagerKind.Repo,
    name: displayName,
    isOrphaned,
    isReadOnly,
  });

  const { filePath, fragmentRef } = splitSourcePath(sourcePath);

  // Source file link: Editors/Admins only, and only for git providers with a browsable web UI
  // (getRepoFileUrl resolves to undefined for local/generic-git). Prefer the ref the resource was
  // loaded from (provisioning previews) over the repository's configured branch.
  const rawSourceUrl =
    contextSrv.isEditor && repository && filePath
      ? getRepoFileUrl({
          repoType: repository.type,
          url: repository.url,
          branch: fragmentRef || repository.branch,
          filePath,
          pathPrefix: repository.path,
        })
      : undefined;
  const sourceUrl = rawSourceUrl ? textUtil.sanitizeUrl(rawSourceUrl) : undefined;

  // Repository administration link, for repository managers. Deliberately gated on write:
  // `provisioning.repositories:read` is granted to the Viewer basic role (git-sync flows need it),
  // so it would match every logged-in user.
  const manageUrl =
    repository && contextSrv.hasPermission(AccessControlAction.ProvisioningRepositoriesWrite)
      ? `${PROVISIONING_URL}/${encodeURIComponent(repository.name ?? repositoryName)}`
      : undefined;

  const badge = <Badge color={color} icon={icon} tooltip={tooltip} />;

  if (isOrphaned || (!sourceUrl && !manageUrl)) {
    return badge;
  }

  return (
    <Stack direction="row" gap={0.5} alignItems="center">
      {badge}
      <Dropdown
        overlay={
          <Menu
            header={
              <Text variant="bodySmall" color="secondary">
                {tooltip}
              </Text>
            }
          >
            {manageUrl && (
              <Menu.Item
                icon="cog"
                label={t('provisioning.managed-badge.manage-repository', 'Manage repository')}
                url={manageUrl}
              />
            )}
            {sourceUrl && (
              <Menu.Item
                icon={(repository?.type && getRepositoryTypeConfig(repository.type)?.icon) || 'external-link-alt'}
                label={t('provisioning.managed-badge.view-source', 'View source')}
                url={sourceUrl}
                target="_blank"
              />
            )}
          </Menu>
        }
      >
        <IconButton
          name="ellipsis-v"
          aria-label={t('provisioning.managed-badge.actions', 'Managed resource actions')}
          aria-haspopup="menu"
        />
      </Dropdown>
    </Stack>
  );
}

function getBadgeDisplay({ managerKind, name, isOrphaned, isReadOnly }: ManagedBadgeProps): {
  color: BadgeColor;
  icon: IconName;
  tooltip: string;
} {
  let color: BadgeColor = 'purple';
  let icon: IconName = 'exchange-alt';
  let tooltip: string;

  switch (managerKind) {
    case ManagerKind.Terraform:
      tooltip = t('provisioning.managed-badge.terraform', 'Managed by: Terraform');
      break;
    case ManagerKind.Kubectl:
      tooltip = t('provisioning.managed-badge.kubectl', 'Managed by: Kubectl');
      break;
    case ManagerKind.Plugin:
      tooltip = t('provisioning.managed-badge.plugin', 'Managed by: Plugin {{id}}', { id: name });
      break;
    case ManagerKind.FileProvisioning:
      tooltip = t('provisioning.managed-badge.file-provisioning', 'Managed by: Grafana configuration');
      break;
    case ManagerKind.ClassicFP:
      tooltip = t('provisioning.managed-badge.classic-file-provisioning', 'Managed by: File provisioning');
      break;
    case ManagerKind.Repo:
      if (isOrphaned) {
        color = 'orange';
        icon = 'exclamation-triangle';
        tooltip = getOrphanedRepositoryTooltip();
      } else {
        tooltip = getManagedByRepositoryTooltip(name);
      }
      break;
    default:
      tooltip = t('provisioning.managed-badge.provisioned', 'Provisioned');
  }

  if (isReadOnly && !isOrphaned) {
    icon = 'exchange-alt-lock';
    tooltip = t('provisioning.managed-badge.read-only', 'Read only, {{managedBy}}', {
      managedBy: tooltip,
      interpolation: { escapeValue: false },
    });
  }

  return { color, icon, tooltip };
}
