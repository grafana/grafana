import { ManagedResourceBreadcrumbBadge } from 'app/features/provisioning/components/ManagedResourceBreadcrumbBadge';
import { isManaged } from 'app/features/provisioning/utils/managedResource';

import { type DashboardScene } from './DashboardScene';

export const ManagedDashboardNavBarBadge = ({ dashboard }: { dashboard: DashboardScene }) => {
  const { meta } = dashboard.useState();
  const resource = { metadata: { annotations: meta.k8s?.annotations } };

  if (!isManaged(resource)) {
    return null;
  }

  // On provisioning previews the source path carries the loaded ref as a `#fragment`
  // (see loadProvisioningDashboard), which the badge resolves to the right branch/commit.
  return (
    <ManagedResourceBreadcrumbBadge resource={resource} canEdit={dashboard.canEditDashboard()} writesBackToRepository />
  );
};
