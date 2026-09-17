import { type ReactNode } from 'react';

import { Spinner } from '@grafana/ui';

import { FormLoadingErrorAlert } from './Dashboards/FormLoadingErrorAlert';
import { OrphanedProvisionedDrawerNotice } from './Dashboards/OrphanedProvisionedDrawerNotice';
import { RepoInvalidStateBanner } from './Shared/RepoInvalidStateBanner';

export interface ProvisionedFormGateProps {
  isLoading?: boolean;
  isOrphaned?: boolean;
  isError?: boolean;
  isMissingRepo?: boolean;
  isReadOnly?: boolean;
  error?: unknown;
  readOnlyMessage?: string;
  children: ReactNode;
}

/**
 * Shared gate for provisioning form wrappers (drawers and inline forms).
 *
 * Maps repository/form-data state to the appropriate fallback, in priority order:
 * loading > orphaned > error > missingRepo > readOnly > children.
 *
 * Children render only when none of the gate flags are truthy.
 *
 * How to wire up the flags:
 * - Dashboard wrappers (useProvisionedDashboardData): map `repoDataStatus` to
 *   `isLoading`/`isOrphaned`, and `repoDataStatus === Error || !defaultValues` to `isError`.
 *   Keep the hook's `readOnly` inside the form (inline banner + disabled submit).
 * - Folder/bulk wrappers (useProvisionedFolderFormData / useGetResourceRepositoryView):
 *   pass the hook's `isLoading`, `isMissingRepo`, and `isReadOnly={isReadOnlyRepo}`
 *   straight through, with the form-specific `readOnlyMessage`.
 */
export function ProvisionedFormGate({
  isLoading,
  isOrphaned,
  isError,
  isMissingRepo,
  isReadOnly,
  error,
  readOnlyMessage,
  children,
}: ProvisionedFormGateProps) {
  if (isLoading) {
    return <Spinner />;
  }

  if (isOrphaned) {
    return <OrphanedProvisionedDrawerNotice />;
  }

  if (isError) {
    return <FormLoadingErrorAlert error={error} />;
  }

  if (isMissingRepo) {
    return <RepoInvalidStateBanner noRepository isReadOnlyRepo={false} />;
  }

  if (isReadOnly) {
    return <RepoInvalidStateBanner noRepository={false} isReadOnlyRepo readOnlyMessage={readOnlyMessage} />;
  }

  return <>{children}</>;
}
