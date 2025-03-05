import { Badge } from '@grafana/ui';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';

import { DashboardScene } from './DashboardScene';

export default function ManagedDashboardNavBarBadge({ dashboard }: { dashboard: DashboardScene }) {
  const obj = dashboard.state.meta.k8s;
  if (!obj?.annotations) {
    return;
  }

  let text = 'Provisioned';
  const kind = obj.annotations?.[AnnoKeyManagerKind];
  const id = obj.annotations?.[AnnoKeyManagerIdentity];
  switch (kind) {
    case ManagerKind.Terraform:
      text = 'Terraform';
    case ManagerKind.Kubectl:
      text = 'Kubectl';
    case ManagerKind.Plugin:
      text = `Plugin: ${id}`;
  }
  return <Badge color="darkgrey" icon="exchange-alt" text={text} key="provisioned-dashboard-button-badge" />;
}
