import { ManagerKind } from 'app/features/apiserver/types';
import { ManagedBadge } from 'app/features/provisioning/components/ManagedBadge';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';

import { type DashboardScene } from './DashboardScene';

export const ManagedDashboardNavBarBadge = ({ dashboard }: { dashboard: DashboardScene }) => {
  dashboard.useState();
  const kind = dashboard.getManagerKind();
  const id = dashboard.getManagerIdentity();
  const { isReadOnlyRepo } = useGetResourceRepositoryView({ name: kind === ManagerKind.Repo ? id : undefined });

  if (!kind) {
    return null;
  }

  // Repository lookup, orphaned detection and permission-gated actions (source file /
  // repository admin links) are handled inside ManagedBadge. On provisioning previews the
  // source path carries the loaded ref as a `#fragment` (see loadProvisioningDashboard),
  // which the badge resolves to the right branch/commit.
  return (
    <ManagedBadge
      managerKind={kind}
      name={id}
      isReadOnly={isReadOnlyRepo && dashboard.canEditDashboard()}
      repositoryName={id}
      sourcePath={dashboard.getPath()}
    />
  );
};
