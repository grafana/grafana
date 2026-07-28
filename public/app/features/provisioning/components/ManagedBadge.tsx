import { css } from '@emotion/css';

import { type GrafanaTheme2, textUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, type BadgeColor, Dropdown, Icon, type IconName, Menu, Text, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { ManagerKind } from 'app/features/apiserver/types';
import { AccessControlAction } from 'app/types/accessControl';

import { PROVISIONING_URL } from '../constants';
import { RepoViewStatus, useGetResourceRepositoryView } from '../hooks/useGetResourceRepositoryView';
import { getRepoFileUrl } from '../utils/git';
import { getManagedByRepositoryTooltip, getOrphanedRepositoryTooltip } from '../utils/tooltip';

interface ManagedBadgeProps {
  /** Which system manages the resource. When omitted, a generic "Provisioned" badge is shown. */
  managerKind?: ManagerKind;
  /** Repository title/name or plugin id, shown in the tooltip where relevant. */
  name?: string;
  /** Repository-managed resource whose backing repository no longer exists. */
  isOrphaned?: boolean;
  /**
   * Manager identity (`grafana.app/managerId`). When set for a repository-managed resource, the
   * badge becomes a dropdown exposing permission-gated actions (source file, repository admin).
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
 * When `repositoryName` is provided for a repository-managed resource, the badge turns into a
 * click-activated dropdown with the available actions: a link to the resource's source file in the
 * git provider (Editors/Admins, when `sourcePath` resolves to a browsable URL) and a link to the
 * repository administration page (repository managers with `provisioning.repositories:write`).
 * Users without any available action (e.g. Viewers) get the plain, non-interactive badge.
 */
export function ManagedBadge({ managerKind, name, isOrphaned = false, repositoryName, sourcePath }: ManagedBadgeProps) {
  // The interactive variant is a separate component so the RTK Query hook only runs (and only
  // requires a store context) when a repository lookup can actually yield actions.
  if (managerKind === ManagerKind.Repo && repositoryName && !isOrphaned) {
    return <RepoManagedBadge name={name} repositoryName={repositoryName} sourcePath={sourcePath} />;
  }

  return <StaticManagedBadge managerKind={managerKind} name={name} isOrphaned={isOrphaned} />;
}

/** Plain, non-interactive badge with a hover tooltip. */
function StaticManagedBadge({ managerKind, name, isOrphaned = false }: ManagedBadgeProps) {
  const { color, icon, tooltip } = getBadgeDisplay({ managerKind, name, isOrphaned });
  return <Badge color={color} icon={icon} tooltip={tooltip} />;
}

interface RepoManagedBadgeProps {
  name?: string;
  repositoryName: string;
  sourcePath?: string;
}

/**
 * The `grafana.app/sourcePath` annotation can carry a `#ref` fragment on provisioning previews
 * (see `loadProvisioningDashboard`, which appends the previewed ref). Split it off so the file
 * path stays valid and the ref can target the right branch/commit in the source link.
 */
function splitSourcePath(sourcePath?: string): { filePath?: string; fragmentRef?: string } {
  if (!sourcePath) {
    return {};
  }
  const hashIndex = sourcePath.indexOf('#');
  if (hashIndex <= 0) {
    return { filePath: sourcePath };
  }
  return { filePath: sourcePath.substring(0, hashIndex), fragmentRef: sourcePath.substring(hashIndex + 1) };
}

/**
 * Repository-managed variant: resolves the repository view (viewer-safe endpoint) and, when the
 * user has any permitted action, renders the badge as a dropdown trigger.
 */
function RepoManagedBadge({ name, repositoryName, sourcePath }: RepoManagedBadgeProps) {
  const styles = useStyles2(getStyles);
  const { repository, status } = useGetResourceRepositoryView({ name: repositoryName });

  const isOrphaned = status === RepoViewStatus.Orphaned;
  const displayName = repository?.title || name || repositoryName;
  const { color, icon, tooltip } = getBadgeDisplay({
    managerKind: ManagerKind.Repo,
    name: displayName,
    isOrphaned,
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

  if (isOrphaned || (!sourceUrl && !manageUrl)) {
    return <Badge color={color} icon={icon} tooltip={tooltip} />;
  }

  return (
    <Dropdown
      overlay={
        <Menu
          header={
            <Text variant="bodySmall" color="secondary">
              {tooltip}
            </Text>
          }
        >
          {sourceUrl && (
            <Menu.Item
              icon="external-link-alt"
              label={t('provisioning.managed-badge.view-source-file', 'View source file')}
              url={sourceUrl}
              target="_blank"
            />
          )}
          {manageUrl && (
            <Menu.Item
              icon="cog"
              label={t('provisioning.managed-badge.manage-repository', 'Manage repository')}
              url={manageUrl}
            />
          )}
        </Menu>
      }
    >
      <button type="button" className={styles.trigger} aria-label={tooltip} aria-haspopup="menu">
        <Badge color={color} icon={icon} text={<Icon name="angle-down" size="sm" />} tooltip={tooltip} />
      </button>
    </Dropdown>
  );
}

function getBadgeDisplay({ managerKind, name, isOrphaned }: ManagedBadgeProps): {
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

  return { color, icon, tooltip };
}

const getStyles = (theme: GrafanaTheme2) => ({
  trigger: css({
    background: 'none',
    border: 'none',
    padding: 0,
    display: 'inline-flex',
    cursor: 'pointer',

    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: '2px',
      borderRadius: theme.shape.radius.sm,
    },
  }),
});
