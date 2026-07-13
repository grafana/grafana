import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { RepoViewStatus } from '../../hooks/useGetResourceRepositoryView';
import { useProvisionedDashboardData } from '../../hooks/useProvisionedDashboardData';
import { ProvisionedFormGate } from '../ProvisionedFormGate';

import { DeleteProvisionedDashboardForm } from './DeleteProvisionedDashboardForm';

export interface Props {
  dashboard: DashboardScene;
  onDismiss: () => void;
}

/**
 * @description
 * Drawer component for deleting a git provisioned dashboard.
 */
export function DeleteProvisionedDashboardDrawer({ dashboard, onDismiss }: Props) {
  const {
    defaultValues,
    loadedFromRef,
    readOnly,
    canPushToConfiguredBranch,
    isNew,
    repository,
    repoDataStatus,
    error,
  } = useProvisionedDashboardData(dashboard);

  return (
    <ProvisionedFormGate
      isLoading={repoDataStatus === RepoViewStatus.Loading}
      isOrphaned={repoDataStatus === RepoViewStatus.Orphaned}
      isError={repoDataStatus === RepoViewStatus.Error || !defaultValues}
      error={error}
    >
      <DeleteProvisionedDashboardForm
        dashboard={dashboard}
        defaultValues={defaultValues!}
        loadedFromRef={loadedFromRef}
        readOnly={readOnly}
        repository={repository}
        isNew={isNew}
        canPushToConfiguredBranch={canPushToConfiguredBranch}
        onDismiss={onDismiss}
      />
    </ProvisionedFormGate>
  );
}
