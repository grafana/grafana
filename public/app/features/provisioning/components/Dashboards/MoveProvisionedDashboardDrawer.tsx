import { Spinner } from '@grafana/ui';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { RepoViewStatus } from '../../hooks/useGetResourceRepositoryView';
import { useProvisionedDashboardData } from '../../hooks/useProvisionedDashboardData';

import { FormLoadingErrorAlert } from './FormLoadingErrorAlert';
import { MoveProvisionedDashboardForm } from './MoveProvisionedDashboardForm';
import { OrphanedProvisionedDrawerNotice } from './OrphanedProvisionedDrawerNotice';

export interface Props {
  dashboard: DashboardScene;
  targetFolderUID?: string;
  targetFolderTitle?: string;
  onDismiss: () => void;
  onSuccess: (folderUID: string, folderTitle: string) => void;
}

export function MoveProvisionedDashboardDrawer({
  dashboard,
  targetFolderUID,
  targetFolderTitle,
  onDismiss,
  onSuccess,
}: Props) {
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
    <MoveProvisionedDashboardForm
      dashboard={dashboard}
      defaultValues={defaultValues}
      loadedFromRef={loadedFromRef}
      readOnly={readOnly}
      repository={repository}
      isNew={isNew}
      canPushToConfiguredBranch={canPushToConfiguredBranch}
      targetFolderUID={targetFolderUID}
      targetFolderTitle={targetFolderTitle}
      onDismiss={onDismiss}
      onSuccess={onSuccess}
    />
  );
}
