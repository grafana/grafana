import { skipToken } from '@reduxjs/toolkit/query';

import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Badge } from '@grafana/ui';
import { useGetRepositoryQuery } from 'app/api/clients/provisioning/v0alpha1';
import { ManagerKind } from 'app/features/apiserver/types';
import { getManagedByRepositoryTooltip } from 'app/features/provisioning/utils/tooltip';

import { DashboardScene } from './DashboardScene';

export const ManagedDashboardNavBarBadge = ({ dashboard }: { dashboard: DashboardScene }) => {
  const kind = dashboard.getManagerKind();
  const id = dashboard.getManagerIdentity();

  const shouldSkipQuery = !config.featureToggles.provisioning || kind !== ManagerKind.Repo || !id;
  const { data: repoData, isError } = useGetRepositoryQuery(shouldSkipQuery ? skipToken : { name: id });

  if (!kind) {
    return null;
  }

  // Repository-managed dashboard where the repo no longer exists
  if (kind === ManagerKind.Repo && !shouldSkipQuery && (isError || (!repoData && id))) {
    const orphanedText = t('dashboard-scene.managed-badge.repository-not-found', 'Repository not found: {{id}}', {
      id,
    });
    return (
      <Badge
        color="orange"
        icon="exclamation-triangle"
        tooltip={orphanedText}
        key="provisioned-dashboard-button-badge"
      />
    );
  }

  let text;

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
    case ManagerKind.Repo:
      text = getManagedByRepositoryTooltip(repoData?.spec?.title || id);
      break;
    default:
      text = t('dashboard-scene.managed-badge.provisioned', 'Provisioned');
  }

  return <Badge color="purple" icon="exchange-alt" tooltip={text} key="provisioned-dashboard-button-badge" />;
};
