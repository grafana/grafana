import { t } from '@grafana/i18n';
import { Badge, type BadgeColor, type IconName } from '@grafana/ui';
import { ManagerKind } from 'app/features/apiserver/types';

import { getManagedByRepositoryTooltip, getOrphanedRepositoryTooltip } from '../utils/tooltip';

interface ManagedBadgeProps {
  /** Which system manages the resource. When omitted, a generic "Provisioned" badge is shown. */
  managerKind?: ManagerKind;
  /** Repository title/name or plugin id, shown in the tooltip where relevant. */
  name?: string;
  /** Repository-managed resource whose backing repository no longer exists. */
  isOrphaned?: boolean;
}

/**
 * Badge indicating that a resource is managed by an external system. It renders the repository
 * (git) style used across folder, dashboard and playlist pages, the terraform/kubectl/plugin
 * variants, the orphaned-repository state (`isOrphaned`), and a generic "Provisioned" fallback when
 * `managerKind` is omitted/unknown. Use it for any resource that `getManagerKind`/`isManaged`
 * reports as managed so the styling stays consistent.
 */
export function ManagedBadge({ managerKind, name, isOrphaned = false }: ManagedBadgeProps) {
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

  return <Badge color={color} icon={icon} tooltip={tooltip} />;
}
