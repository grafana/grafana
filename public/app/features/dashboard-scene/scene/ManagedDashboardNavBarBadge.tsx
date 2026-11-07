import { Stack } from '@grafana/ui';
import { ManagedBadge } from 'app/features/provisioning/components/ManagedBadge';

import { type DashboardScene } from './DashboardScene';

interface Props {
  dashboard: DashboardScene;
  /** Whether the dashboard's manager permits edits. Omitted for users who cannot edit it anyway. */
  managerAllowsEdits?: boolean;
}

export const ManagedDashboardNavBarBadge = ({ dashboard, managerAllowsEdits }: Props) => {
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
      <ManagedBadge
        managerKind={kind}
        name={id}
        repositoryName={id}
        sourcePath={dashboard.getPath()}
        managerAllowsEdits={managerAllowsEdits}
      />
    </Stack>
  );
};
