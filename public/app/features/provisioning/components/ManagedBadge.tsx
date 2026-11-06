import { css } from '@emotion/css';

import { type GrafanaTheme2, textUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Badge, type BadgeColor, Dropdown, Icon, type IconName, Menu, Stack, Text, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { ManagerKind } from 'app/features/apiserver/types';
import { AccessControlAction } from 'app/types/accessControl';

import { PROVISIONING_URL } from '../constants';
import { RepoViewStatus, useGetResourceRepositoryView } from '../hooks/useGetResourceRepositoryView';
import { getRepoFileUrl } from '../utils/git';
import {
  getManagedAccessLabel,
  getManagedByRepositoryTooltip,
  getManagerAccessLabel,
  getOrphanedRepositoryTooltip,
} from '../utils/tooltip';

import { splitSourcePath } from './utils/path';

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
  /**
   * Whether the resource's manager permits edits in Grafana (`managerAllowsEdits`): a read-only
   * repository or a manager that has not opted in makes it `false`. Adds a pen/lock icon and names
   * the state in the tooltip. Omit it where the policy is unknown or of no use to the viewer; the
   * user's own permissions and the resource's spec are separate conditions the caller counts.
   */
  managerAllowsEdits?: boolean;
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
export function ManagedBadge({
  managerKind,
  name,
  isOrphaned = false,
  repositoryName,
  sourcePath,
  managerAllowsEdits,
}: ManagedBadgeProps) {
  // The interactive variant is a separate component so the RTK Query hook only runs (and only
  // requires a store context) when a repository lookup can actually yield actions.
  if (config.provisioningEnabled && managerKind === ManagerKind.Repo && repositoryName && !isOrphaned) {
    return (
      <RepoManagedBadge
        name={name}
        repositoryName={repositoryName}
        sourcePath={sourcePath}
        managerAllowsEdits={managerAllowsEdits}
      />
    );
  }

  return (
    <StaticManagedBadge
      managerKind={managerKind}
      name={name}
      isOrphaned={isOrphaned}
      managerAllowsEdits={managerAllowsEdits}
    />
  );
}

/** Plain, non-interactive badge with a hover tooltip. */
function StaticManagedBadge({ managerKind, name, isOrphaned = false, managerAllowsEdits }: ManagedBadgeProps) {
  const { color, icon, tooltip, isLocked } = getBadgeDisplay({ managerKind, name, isOrphaned, managerAllowsEdits });
  return (
    <Badge
      color={color}
      tooltip={
        managerAllowsEdits === undefined || isOrphaned ? (
          tooltip
        ) : (
          <ManagedBadgeTooltip managedBy={tooltip} allowsEdits={managerAllowsEdits} />
        )
      }
      text={<ManagerIcon icon={icon} isLocked={isLocked} />}
    />
  );
}

interface RepoManagedBadgeProps {
  name?: string;
  repositoryName: string;
  sourcePath?: string;
  managerAllowsEdits?: boolean;
}

/**
 * Repository-managed variant: resolves the repository view (viewer-safe endpoint) and, when the
 * user has any permitted action, renders the badge as a dropdown trigger.
 */
function RepoManagedBadge({ name, repositoryName, sourcePath, managerAllowsEdits }: RepoManagedBadgeProps) {
  const styles = useStyles2(getStyles);
  const { repository, status } = useGetResourceRepositoryView({ name: repositoryName });

  const isOrphaned = status === RepoViewStatus.Orphaned;
  const displayName = repository?.title || name || repositoryName;
  const { color, icon, tooltip, isLocked } = getBadgeDisplay({
    managerKind: ManagerKind.Repo,
    name: displayName,
    isOrphaned,
    managerAllowsEdits,
  });
  const showsPolicy = managerAllowsEdits !== undefined && !isOrphaned;
  const allowsEdits = Boolean(managerAllowsEdits);
  const badgeTooltip = showsPolicy ? <ManagedBadgeTooltip managedBy={tooltip} allowsEdits={allowsEdits} /> : tooltip;
  const label = showsPolicy ? getManagedAccessLabel(tooltip, allowsEdits) : tooltip;

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
    return <Badge color={color} tooltip={badgeTooltip} text={<ManagerIcon icon={icon} isLocked={isLocked} />} />;
  }

  return (
    <Dropdown
      overlay={
        <Menu
          header={
            showsPolicy ? (
              <ManagedBadgeTooltip managedBy={tooltip} allowsEdits={allowsEdits} />
            ) : (
              <Text variant="bodySmall" color="secondary">
                {tooltip}
              </Text>
            )
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
      <button type="button" className={styles.trigger} aria-label={label} aria-haspopup="menu">
        <Badge
          color={color}
          text={
            <>
              <ManagerIcon icon={icon} isLocked={isLocked} />
              <Icon name="angle-down" size="sm" />
            </>
          }
          tooltip={badgeTooltip}
        />
      </button>
    </Dropdown>
  );
}

/** The manager's icon, with a lock badged on its corner when the manager forbids edits. */
function ManagerIcon({ icon, isLocked }: { icon: IconName; isLocked: boolean }) {
  const styles = useStyles2(getStyles);

  if (!isLocked) {
    return <Icon name={icon} size="sm" />;
  }

  return (
    <span className={styles.lockedIcon}>
      <Icon name={icon} size="sm" className={styles.managerIcon} />
      <Icon name="lock" className={styles.lock} />
    </span>
  );
}

/** Tooltip and dropdown header: what the manager allows, with who manages the resource below it. */
function ManagedBadgeTooltip({ managedBy, allowsEdits }: { managedBy: string; allowsEdits: boolean }) {
  return (
    <Stack direction="column" gap={0.25}>
      <Stack direction="row" gap={0.5} alignItems="center">
        <Icon name={getAccessIcon(allowsEdits)} size="sm" />
        <Text weight="medium">{getManagerAccessLabel(allowsEdits)}</Text>
      </Stack>
      <Text variant="bodySmall" color="secondary">
        {managedBy}
      </Text>
    </Stack>
  );
}

function getAccessIcon(allowsEdits: boolean): IconName {
  return allowsEdits ? 'pen' : 'lock';
}

function getBadgeDisplay({ managerKind, name, isOrphaned, managerAllowsEdits }: ManagedBadgeProps): {
  color: BadgeColor;
  icon: IconName;
  /** Who manages the resource; the tooltip and the dropdown header show it under the access state. */
  tooltip: string;
  isLocked: boolean;
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

  // The orphaned state is its own warning; what the manager allows is beside the point until it is
  // resolved.
  return { color, icon, tooltip, isLocked: managerAllowsEdits === false && !isOrphaned };
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Wide enough for the lock to sit past the manager icon's right edge; the badge clips whatever
  // overflows, so the lock has to stay inside the box.
  lockedIcon: css({
    position: 'relative',
    display: 'inline-flex',
    width: 18,
    height: '1lh',
    flexShrink: 0,
  }),

  managerIcon: css({
    position: 'absolute',
    left: 0,
    top: 'calc(50% - 7px)',
    // The badge background is translucent, so the lock needs a hole rather than a filled halo to
    // read against the icon underneath.
    maskImage: 'radial-gradient(circle 5px at 13.5px 4.5px, transparent 98%, #000 100%)',
  }),

  lock: css({
    position: 'absolute',
    right: 0,
    top: 'calc(50% - 7px)',
    width: 9,
    height: 9,
  }),

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
