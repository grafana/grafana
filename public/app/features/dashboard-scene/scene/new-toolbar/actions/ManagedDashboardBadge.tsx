import { Badge } from '@grafana/ui';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';

import { ToolbarActionProps } from '../types';

export const ManagedDashboardBadge = ({ dashboard }: ToolbarActionProps) => {
  if (!dashboard.state.meta.k8s?.annotations) {
    return null;
  }

  let text = 'Provisioned';
  const kind = dashboard.state.meta.k8s.annotations[AnnoKeyManagerKind];
  const id = dashboard.state.meta.k8s.annotations[AnnoKeyManagerIdentity];

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
    case ManagerKind.Repo:
      text = 'Repository';
      break;
  }

  return <Badge color="purple" icon="exchange-alt" tooltip={text} key="provisioned-dashboard-button-badge" />;
};
