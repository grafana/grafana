import { css } from '@emotion/css';
import { useRef } from 'react';

import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Badge, Stack, Tooltip, type BadgeColor, type IconName } from '@grafana/ui';
import { ManagerKind } from 'app/features/apiserver/types';

import { getManagedByRepositoryTooltip, getOrphanedRepositoryTooltip } from '../utils/tooltip';

import { SourceLink } from './SourceLink';
import { ViewRepositoryButton } from './ViewRepositoryButton';

interface ManagedBadgeProps {
  /** Which system manages the resource. When omitted, a generic "Provisioned" badge is shown. */
  managerKind?: ManagerKind;
  /** Repository title/name or plugin id, shown in the tooltip where relevant. */
  name?: string;
  /** Repository-managed resource whose backing repository no longer exists. */
  isOrphaned?: boolean;
  /**
   * Name of the managing repository (`grafana.app/managerId`). When set on a repository-managed
   * resource, the badge reveals its source-file link and the (admin-only) repository link on hover,
   * so callers don't need to render `SourceLink`/`ViewRepositoryButton` alongside it.
   */
  repositoryName?: string;
  /** Path of the resource's source file within the repository (`grafana.app/sourcePath`); enables the "Source" link. */
  sourcePath?: string;
}

/**
 * Badge indicating that a resource is managed by an external system. It renders the repository
 * (git) style used across folder, dashboard and playlist pages, the terraform/kubectl/plugin
 * variants, the orphaned-repository state (`isOrphaned`), and a generic "Provisioned" fallback when
 * `managerKind` is omitted/unknown. Use it for any resource that `getManagerKind`/`isManaged`
 * reports as managed so the styling stays consistent.
 *
 * For repository-managed resources, pass `repositoryName` (and `sourcePath`) to surface the source
 * file link and the admin repository link on hover in a single interactive tooltip.
 */
export function ManagedBadge({ managerKind, name, isOrphaned = false, repositoryName, sourcePath }: ManagedBadgeProps) {
  // Report a hover once per pointer/focus session (reset on leave/blur) so continuous movement over
  // the badge doesn't inflate the count. Paired with the source/repository link click events, this
  // measures how often users reveal the links vs. act on them.
  const hasReportedHover = useRef(false);
  const reportHover = () => {
    if (hasReportedHover.current) {
      return;
    }
    hasReportedHover.current = true;
    reportInteraction('grafana_provisioning_managed_badge_hovered', { managerKind });
  };
  const resetHover = () => {
    hasReportedHover.current = false;
  };

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

  // A live repository-managed resource can link back to its source file and (for admins) to the
  // repository config page. Surface those on hover in an interactive tooltip instead of requiring
  // callers to render SourceLink / ViewRepositoryButton next to the badge. The links self-gate
  // (git provider, source path, permission) and only mount when the tooltip opens, so nothing is
  // fetched until the user hovers.
  const showRepositoryLinks = managerKind === ManagerKind.Repo && !isOrphaned && Boolean(repositoryName);

  if (showRepositoryLinks) {
    const content = (
      <Stack direction="column" gap={1} alignItems="flex-start">
        <span>{tooltip}</span>
        <Stack direction="row" gap={1} wrap>
          {/* SourceLink self-gates on git provider, but only mount it when there is a source file to
              link to — folders map to a directory and pass none, so we avoid a pointless settings query. */}
          {sourcePath && <SourceLink repositoryName={repositoryName} sourcePath={sourcePath} />}
          {/* Repository (admin) link. Self-gates on `provisioning.repositories:read`, so editors who
              lack it see only the source link. */}
          <ViewRepositoryButton repositoryName={repositoryName} showLabel />
        </Stack>
      </Stack>
    );

    return (
      // Hover handlers live on this outer wrapper because Tooltip clones its child and overrides its
      // event props with its own hover/focus interactions, which would drop handlers set here.
      <span
        className={badgeWrap}
        onMouseEnter={reportHover}
        onMouseLeave={resetHover}
        onFocus={reportHover}
        onBlur={resetHover}
      >
        <Tooltip content={content} placement="auto" interactive>
          <span className={badgeWrap}>
            <Badge color={color} icon={icon} />
          </span>
        </Tooltip>
      </span>
    );
  }

  return <Badge color={color} icon={icon} tooltip={tooltip} />;
}

const badgeWrap = css({
  display: 'inline-flex',
});
