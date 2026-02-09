import { t } from '@grafana/i18n';

/**
 * Returns the tooltip text for a resource managed by a repository.
 * Shared by ManagedDashboardNavBarBadge and FolderRepo.
 */
export function getManagedByRepositoryTooltip(title?: string): string {
  if (!title) {
    return t('provisioning.managed-by-repository-tooltip', 'Managed by: Repository');
  }
  return t('provisioning.managed-by-repository-tooltip', 'Managed by: Repository {{title}}', {
    title,
    interpolation: { escapeValue: false },
  });
}

// Right now we only support local file provisioning message and git provisioned. This can be extended in the future as needed.
export const getReadOnlyTooltipText = ({ isLocal = false }) => {
  return isLocal
    ? t(
        'provisioning.read-only-local-tooltip',
        'This resource is read-only and provisioned through file provisioning. To make any changes, update the connected repository. To modify the settings go to Administration > Provisioning > Repositories.'
      )
    : t(
        'provisioning.read-only-remote-tooltip',
        'This resource is read-only and provisioned through Git. To make any changes, update the connected repository. To modify the settings go to Administration > Provisioning > Repositories.'
      );
};
