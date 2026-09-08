import { type SaveDashboardDrawer } from 'app/features/dashboard-scene/saving/SaveDashboardDrawer';
import { type DashboardChangeInfo } from 'app/features/dashboard-scene/saving/shared';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { RepoViewStatus } from '../../hooks/useGetResourceRepositoryView';
import { useProvisionedDashboardData } from '../../hooks/useProvisionedDashboardData';
import { ProvisionedFormGate } from '../ProvisionedFormGate';

import { SaveProvisionedDashboardForm } from './SaveProvisionedDashboardForm';

export interface SaveProvisionedDashboardProps {
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
  saveAsCopy?: boolean;
  /** Recovery entry point: default the form to a brand-new branch (see useProvisionedDashboardData). */
  forceNewBranch?: boolean;
  /**
   * Recovery entry point: the dashboard was created on the deleted branch and never merged, so the
   * file doesn't exist on the configured branch the recovery branch is cut from — save must create
   * it rather than update it.
   */
  isUnmergedDraft?: boolean;
}

export function SaveProvisionedDashboard({
  drawer,
  changeInfo,
  dashboard,
  saveAsCopy,
  forceNewBranch,
  isUnmergedDraft,
}: SaveProvisionedDashboardProps) {
  const { isNew, defaultValues, canPushToConfiguredBranch, readOnly, repository, repoDataStatus, error } =
    useProvisionedDashboardData(dashboard, saveAsCopy, forceNewBranch);

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
        forceNewBranch={forceNewBranch}
        isUnmergedDraft={isUnmergedDraft}
      />
    </ProvisionedFormGate>
  );
}
