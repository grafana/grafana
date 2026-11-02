import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { useDashboardRepositoryView } from '../../hooks/useDashboardRepositoryView';
import { RepoViewStatus } from '../../hooks/useGetResourceRepositoryView';
import { useProvisionedDashboardData } from '../../hooks/useProvisionedDashboardData';
import { ProvisionedFormGate } from '../ProvisionedFormGate';

import { MoveProvisionedDashboardForm } from './MoveProvisionedDashboardForm';

export interface Props {
  dashboard: DashboardScene;
  targetFolderUID?: string;
  onDismiss: () => void;
}

export function MoveProvisionedDashboardDrawer({ dashboard, targetFolderUID, onDismiss }: Props) {
  const view = useDashboardRepositoryView(dashboard);
  const { defaultValues, readOnly, canPushToConfiguredBranch, isNew, repository, repoDataStatus, error } =
    useProvisionedDashboardData(dashboard, view);

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
        readOnly={readOnly}
        repository={repository}
        isNew={isNew}
        canPushToConfiguredBranch={canPushToConfiguredBranch}
        targetFolderUID={targetFolderUID}
        onDismiss={onDismiss}
      />
    </ProvisionedFormGate>
  );
}
