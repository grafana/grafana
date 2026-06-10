import { type ReactNode } from 'react';

import { Spinner } from '@grafana/ui';

import { FormLoadingErrorAlert } from './Dashboards/FormLoadingErrorAlert';
import { OrphanedProvisionedDrawerNotice } from './Dashboards/OrphanedProvisionedDrawerNotice';
import { RepoInvalidStateBanner } from './Shared/RepoInvalidStateBanner';

export interface ProvisionedFormShellProps {
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
 * Fail-closed by construction: children render only when every flag is false.
 *
 * Recipe:
 * - Dashboard wrappers (useProvisionedDashboardData): map `repoDataStatus` to
 *   `isLoading`/`isOrphaned`, and `repoDataStatus === Error || !defaultValues` to `isError`.
 *   Keep the hook's `readOnly` inside the form (inline banner + disabled submit).
 * - Folder/bulk wrappers (useProvisionedFolderFormData / useGetResourceRepositoryView):
 *   `isLoading={isLoading}`, `isMissingRepo={!isLoading && !isReadOnlyRepo && !data}`,
 *   `isReadOnly={isReadOnlyRepo}` with the form-specific `readOnlyMessage`.
 */
export function ProvisionedFormShell({
  isLoading,
  isOrphaned,
  isError,
  isMissingRepo,
  isReadOnly,
  error,
  readOnlyMessage,
  children,
}: ProvisionedFormShellProps) {
  if (isLoading) {
    return <Spinner />;
  }

  if (isOrphaned) {
    return <OrphanedProvisionedDrawerNotice />;
  }

  if (isError) {
    return <FormLoadingErrorAlert error={error} />;
  }

  if (isMissingRepo || isReadOnly) {
    return (
      <RepoInvalidStateBanner
        noRepository={Boolean(isMissingRepo)}
        isReadOnlyRepo={Boolean(isReadOnly)}
        readOnlyMessage={readOnlyMessage}
      />
    );
  }

  return <>{children}</>;
}
