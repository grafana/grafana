import { ManagedResourceBadge } from 'app/features/provisioning/components/ManagedResourceBadge';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';

import { type DashboardScene } from './DashboardScene';

export const ManagedDashboardNavBarBadge = ({ dashboard }: { dashboard: DashboardScene }) => {
  dashboard.useState();
  const kind = dashboard.getManagerKind();
  const id = dashboard.getManagerIdentity();
  const { isReadOnlyRepo } = useGetResourceRepositoryView({ name: dashboard.isManagedRepository() ? id : undefined });

  if (!kind) {
    return null;
  }

  return (
    <ManagedResourceBadge
      managerKind={kind}
      name={id}
      isReadOnly={isReadOnlyRepo && dashboard.canEditDashboard()}
      repositoryName={id}
      sourcePath={dashboard.getPath()}
    />
  );
};
