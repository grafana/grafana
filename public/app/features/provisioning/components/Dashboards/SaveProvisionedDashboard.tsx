import { type SaveDashboardDrawer } from 'app/features/dashboard-scene/saving/SaveDashboardDrawer';
import { type DashboardChangeInfo } from 'app/features/dashboard-scene/saving/shared';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { type DashboardRepositoryView } from '../../hooks/useDashboardRepositoryView';
import { RepoViewStatus } from '../../hooks/useGetResourceRepositoryView';
import { useProvisionedDashboardData } from '../../hooks/useProvisionedDashboardData';
import { ProvisionedFormGate } from '../ProvisionedFormGate';

import { SaveProvisionedDashboardForm } from './SaveProvisionedDashboardForm';

export interface SaveProvisionedDashboardProps {
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
  saveAsCopy?: boolean;
}

interface Props extends SaveProvisionedDashboardProps {
  view: DashboardRepositoryView;
}

export function SaveProvisionedDashboard({ drawer, changeInfo, dashboard, saveAsCopy, view }: Props) {
  const { defaultValues, canPushToConfiguredBranch, readOnly, repository, repoDataStatus, error } =
    useProvisionedDashboardData(dashboard, view, { saveAsCopy, ...drawer.saveFormDraft });

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
        isNew={view.isNewSave}
        defaultValues={defaultValues!}
        repository={repository}
        canPushToConfiguredBranch={canPushToConfiguredBranch}
        readOnly={readOnly}
        saveAsCopy={saveAsCopy}
        isHeld={view.isHeld}
      />
    </ProvisionedFormGate>
  );
}
