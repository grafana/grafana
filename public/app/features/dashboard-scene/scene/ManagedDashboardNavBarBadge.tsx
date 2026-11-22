import { ManagedResourceBadge } from 'app/features/provisioning/components/ManagedResourceBadge';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';

import { type DashboardScene } from './DashboardScene';

export const ManagedDashboardNavBarBadge = ({ dashboard }: { dashboard: DashboardScene }) => {
  dashboard.useState();
  const kind = dashboard.getManagerKind();
  const id = dashboard.getManagerIdentity();
  const isRepository = dashboard.isManagedRepository();
  const { isReadOnlyRepo } = useGetResourceRepositoryView({ name: isRepository ? id : undefined });

  if (!kind) {
    return null;
  }

  // Only users who could otherwise edit need to know why they can't.
  const isReadOnly =
    dashboard.canEditDashboard() && (isRepository ? isReadOnlyRepo : dashboard.managedResourceCannotBeEdited());

  // On provisioning previews the source path carries the loaded ref as a `#fragment`
  // (see loadProvisioningDashboard), which the badge resolves to the right branch/commit.
  return (
    <ManagedResourceBadge
      managerKind={kind}
      name={id}
      isReadOnly={isReadOnly}
      repositoryName={id}
      sourcePath={dashboard.getPath()}
    />
  );
};
