import { t } from '@grafana/i18n';
import { Badge } from '@grafana/ui';
import { ManagerKind } from 'app/features/apiserver/types';

import { DashboardScene } from './DashboardScene';

export const ManagedDashboardNavBarBadge = ({ dashboard }: { dashboard: DashboardScene }) => {
  if (!dashboard.state.meta.k8s?.annotations) {
    return null;
  }

  let text;
  const kind = dashboard.getManagerKind();
  const id = dashboard.getManagerIdentity();

  switch (kind) {
    case ManagerKind.Terraform:
      text = t('dashboard-scene.managed-badge.terraform', 'Managed by: Terraform');
      break;
    case ManagerKind.Kubectl:
      text = t('dashboard-scene.managed-badge.kubectl', 'Managed by: Kubectl');
      break;
    case ManagerKind.Plugin:
      text = t('dashboard-scene.managed-badge.plugin', 'Managed by: Plugin: {{id}}', { id });
      break;
    case ManagerKind.Repo:
      text = t('dashboard-scene.managed-badge.repository', 'Managed by: Repository');
      break;
    default:
      console.error('Unknown kind ' + kind);
      return null;
  }

  return <Badge color="purple" icon="exchange-alt" tooltip={text} key="provisioned-dashboard-button-badge" />;
};
