import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { RepoViewStatus } from '../../hooks/useGetResourceRepositoryView';
import { useProvisionedDashboardData } from '../../hooks/useProvisionedDashboardData';
import { ProvisionedFormGate } from '../ProvisionedFormGate';

import { MoveProvisionedDashboardForm } from './MoveProvisionedDashboardForm';

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

  return (
    <ProvisionedFormGate
      isLoading={repoDataStatus === RepoViewStatus.Loading}
      isOrphaned={repoDataStatus === RepoViewStatus.Orphaned}
      isError={repoDataStatus === RepoViewStatus.Error || !defaultValues}
      error={error}
    >
      <MoveProvisionedDashboardForm
        dashboard={dashboard}
        defaultValues={defaultValues!}
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
    </ProvisionedFormGate>
  );
}
