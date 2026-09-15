import { Stack } from '@grafana/ui';
import { ManagedBadge } from 'app/features/provisioning/components/ManagedBadge';

import { type DashboardScene } from './DashboardScene';

export const ManagedDashboardNavBarBadge = ({ dashboard }: { dashboard: DashboardScene }) => {
  const kind = dashboard.getManagerKind();
  const id = dashboard.getManagerIdentity();

  if (!kind) {
    return null;
  }

  // Repository lookup, orphaned detection and permission-gated actions (source file /
  // repository admin links) are handled inside ManagedBadge. On provisioning previews the
  // source path carries the loaded ref as a `#fragment` (see loadProvisioningDashboard),
  // which the badge resolves to the right branch/commit.
  return (
    <Stack direction="row" alignItems="stretch">
      <ManagedBadge managerKind={kind} name={id} repositoryName={id} sourcePath={dashboard.getPath()} />
    </Stack>
  );
};
