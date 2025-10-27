import { skipToken } from '@reduxjs/toolkit/query';

import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Badge } from '@grafana/ui';
import { useGetRepositoryQuery } from 'app/api/clients/provisioning/v0alpha1';
import { ManagerKind } from 'app/features/apiserver/types';

import { DashboardScene } from './DashboardScene';

export const ManagedDashboardNavBarBadge = ({ dashboard }: { dashboard: DashboardScene }) => {
  const kind = dashboard.getManagerKind();
  const id = dashboard.getManagerIdentity();

  const shouldSkipQuery = !config.featureToggles.provisioning || kind !== ManagerKind.Repo || !id;
  const { data: repoData } = useGetRepositoryQuery(shouldSkipQuery ? skipToken : { name: id });

  if (!kind) {
    return null;
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
      text = t('dashboard-scene.managed-badge.repository', 'Managed by: Repository {{title}}', {
        title: repoData?.spec?.title || id,
        interpolation: { escapeValue: false },
      });
      break;
    default:
      text = t('dashboard-scene.managed-badge.provisioned', 'Provisioned');
  }

  return <Badge color="purple" icon="exchange-alt" tooltip={text} key="provisioned-dashboard-button-badge" />;
};
