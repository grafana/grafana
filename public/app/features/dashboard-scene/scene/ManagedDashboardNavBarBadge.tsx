import { useLocation } from 'react-router-dom-v5-compat';

import { Stack } from '@grafana/ui';
import { ManagedBadge } from 'app/features/provisioning/components/ManagedBadge';
import { PROVISIONING_PREVIEW_URL } from 'app/features/provisioning/constants';

import { type DashboardScene } from './DashboardScene';

export const ManagedDashboardNavBarBadge = ({ dashboard }: { dashboard: DashboardScene }) => {
  const location = useLocation();
  const kind = dashboard.getManagerKind();
  const id = dashboard.getManagerIdentity();

  if (!kind) {
    return null;
  }

  // On provisioning previews the dashboard is loaded from a specific ref (`?ref=` param) that may
  // differ from the repository's configured branch, so the source link must target that ref.
  // Trailing slash enforces a path-segment match so unrelated prefixes don't match.
  const isProvisioningPreview = location.pathname.startsWith(PROVISIONING_PREVIEW_URL + '/');
  const previewRef = isProvisioningPreview ? (new URLSearchParams(location.search).get('ref') ?? undefined) : undefined;

  // Repository lookup, orphaned detection and permission-gated actions (source file /
  // repository admin links) are handled inside ManagedBadge.
  return (
    <Stack direction="row" alignItems="stretch">
      <ManagedBadge
        managerKind={kind}
        name={id}
        repositoryName={id}
        sourcePath={dashboard.getPath()}
        sourceRef={previewRef}
      />
    </Stack>
  );
};
