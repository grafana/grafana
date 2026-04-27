import { skipToken } from '@reduxjs/toolkit/query';

import { t } from '@grafana/i18n';
import { config, isFetchError } from '@grafana/runtime';
import { Badge, type BadgeColor } from '@grafana/ui';
import type { IconName } from '@grafana/ui/types';
import { useGetRepositoryQuery } from 'app/api/clients/provisioning/v0alpha1';
import { ManagerKind } from 'app/features/apiserver/types';
import { getManagedByRepositoryTooltip, getOrphanedRepositoryTooltip } from 'app/features/provisioning/utils/tooltip';

import { type DashboardScene } from './DashboardScene';

export const ManagedDashboardNavBarBadge = ({ dashboard }: { dashboard: DashboardScene }) => {
  const kind = dashboard.getManagerKind();
  const id = dashboard.getManagerIdentity();

  const shouldSkipQuery = !config.featureToggles.provisioning || kind !== ManagerKind.Repo || !id;
  const { data: repoData, isError, error } = useGetRepositoryQuery(shouldSkipQuery ? skipToken : { name: id });

  if (!kind) {
    return null;
  }

  let text;
  let color: BadgeColor = 'purple';
  let icon: IconName = 'exchange-alt';

  switch (kind) {
    case ManagerKind.Terraform:
      text = t('dashboard-scene.managed-badge.terraform', 'Managed by: Terraform');
      break;
    case ManagerKind.Kubectl:
      text = t('dashboard-scene.managed-badge.kubectl', 'Managed by: Kubectl');
      break;
    case ManagerKind.Plugin:
      text = t('dashboard-scene.managed-badge.plugin', 'Managed by: Plugin {{id}}', { id });
      break;
    case ManagerKind.Repo: {
      // Repository-managed dashboard where the repo no longer exists
      // All other places where we check for orphaned resources (e.g. OrphanedResourceBanner) are using useGetResourceRepositoryView
      // Reason we don't here is because useGetResourceRepositoryView its much heavier than what's needed here and that hook also fetches folder data
      const isOrphaned = isError && isFetchError(error) && error.status === 404;
      text = isOrphaned ? getOrphanedRepositoryTooltip() : getManagedByRepositoryTooltip(repoData?.spec?.title || id);
      color = isOrphaned ? 'orange' : 'purple';
      icon = isOrphaned ? 'exclamation-triangle' : 'exchange-alt';
      break;
    }
    default:
      text = t('dashboard-scene.managed-badge.provisioned', 'Provisioned');
  }

  return <Badge color={color} icon={icon} tooltip={text} key="provisioned-dashboard-button-badge" />;
};
