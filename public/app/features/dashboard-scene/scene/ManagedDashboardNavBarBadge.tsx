import { Badge } from '@grafana/ui';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';
import { DashboardMeta } from 'app/types';

export default function ManagedDashboardNavBarBadge({ meta }: { meta: DashboardMeta }) {
  const obj = meta.k8s;
  if (!obj?.annotations) {
    return;
  }

  let text = 'Provisioned';
  const kind = obj.annotations?.[AnnoKeyManagerKind];
  const id = obj.annotations?.[AnnoKeyManagerIdentity];
  switch (kind) {
    case ManagerKind.Terraform:
      text = 'Terraform';
      break;
    case ManagerKind.Kubectl:
      text = 'Kubectl';
      break;
    case ManagerKind.Plugin:
      text = `Plugin: ${id}`;
      break;
  }
  return <Badge color="darkgrey" icon="exchange-alt" text={text} key="provisioned-dashboard-button-badge" />;
}
