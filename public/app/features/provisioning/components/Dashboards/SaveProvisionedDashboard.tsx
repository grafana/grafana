import { type SaveDashboardDrawer } from 'app/features/dashboard-scene/saving/SaveDashboardDrawer';
import { type DashboardChangeInfo } from 'app/features/dashboard-scene/saving/shared';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { RepoViewStatus } from '../../hooks/useGetResourceRepositoryView';
import { useProvisionedDashboardData } from '../../hooks/useProvisionedDashboardData';
import { type RecoverToNewBranch } from '../../types';
import { ProvisionedFormGate } from '../ProvisionedFormGate';

import { SaveProvisionedDashboardForm } from './SaveProvisionedDashboardForm';

export interface SaveProvisionedDashboardProps {
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
  saveAsCopy?: boolean;
  recoverToNewBranch?: RecoverToNewBranch;
}

export function SaveProvisionedDashboard({
  drawer,
  changeInfo,
  dashboard,
  saveAsCopy,
  recoverToNewBranch,
}: SaveProvisionedDashboardProps) {
  const { isNew, defaultValues, canPushToConfiguredBranch, readOnly, repository, repoDataStatus, error } =
    useProvisionedDashboardData(dashboard, saveAsCopy, recoverToNewBranch);

  return (
    <ProvisionedFormGate
      isLoading={repoDataStatus === RepoViewStatus.Loading}
      isOrphaned={repoDataStatus === RepoViewStatus.Orphaned}
      isError={repoDataStatus === RepoViewStatus.Error || !defaultValues}
      error={error}
    >
      <SaveProvisionedDashboardForm
        dashboard={dashboard}
        drawer={drawer}
        changeInfo={changeInfo}
        isNew={isNew || !!saveAsCopy}
        defaultValues={defaultValues!}
        repository={repository}
        canPushToConfiguredBranch={canPushToConfiguredBranch}
        readOnly={readOnly}
        saveAsCopy={saveAsCopy}
        recoverToNewBranch={recoverToNewBranch}
      />
    </ProvisionedFormGate>
  );
}
