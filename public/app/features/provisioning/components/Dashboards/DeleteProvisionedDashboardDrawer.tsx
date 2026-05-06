import { Spinner } from '@grafana/ui';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { RepoViewStatus } from '../../hooks/useGetResourceRepositoryView';
import { useProvisionedDashboardData } from '../../hooks/useProvisionedDashboardData';

import { DeleteProvisionedDashboardForm } from './DeleteProvisionedDashboardForm';
import { FormLoadingErrorAlert } from './FormLoadingErrorAlert';
import { OrphanedProvisionedDrawerNotice } from './OrphanedProvisionedDrawerNotice';

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

  if (repoDataStatus === RepoViewStatus.Loading) {
    return <Spinner />;
  }

  if (repoDataStatus === RepoViewStatus.Orphaned) {
    return <OrphanedProvisionedDrawerNotice />;
  }

  if (repoDataStatus === RepoViewStatus.Error || !defaultValues) {
    return <FormLoadingErrorAlert error={error} />;
  }

  return (
    <DeleteProvisionedDashboardForm
      dashboard={dashboard}
      defaultValues={defaultValues}
      loadedFromRef={loadedFromRef}
      readOnly={readOnly}
      repository={repository}
      isNew={isNew}
      canPushToConfiguredBranch={canPushToConfiguredBranch}
      onDismiss={onDismiss}
    />
  );
}
