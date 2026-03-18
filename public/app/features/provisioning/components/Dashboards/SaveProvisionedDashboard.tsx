import { Spinner } from '@grafana/ui';
import { SaveDashboardDrawer } from 'app/features/dashboard-scene/saving/SaveDashboardDrawer';
import { DashboardChangeInfo } from 'app/features/dashboard-scene/saving/shared';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { RepoViewStatus } from '../../hooks/useGetResourceRepositoryView';
import { useProvisionedDashboardData } from '../../hooks/useProvisionedDashboardData';

import { FormLoadingErrorAlert } from './FormLoadingErrorAlert';
import { SaveProvisionedDashboardForm } from './SaveProvisionedDashboardForm';

export interface SaveProvisionedDashboardProps {
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
  saveAsCopy?: boolean;
}

export function SaveProvisionedDashboard({ drawer, changeInfo, dashboard, saveAsCopy }: SaveProvisionedDashboardProps) {
  const { isNew, defaultValues, canPushToConfiguredBranch, readOnly, repository, repoDataStatus, error } =
    useProvisionedDashboardData(dashboard, saveAsCopy);

  if (repoDataStatus === RepoViewStatus.Loading) {
    return <Spinner />;
  }

  if (repoDataStatus === RepoViewStatus.Error || !defaultValues) {
    return <FormLoadingErrorAlert error={error} />;
  }

  return (
    <SaveProvisionedDashboardForm
      dashboard={dashboard}
      drawer={drawer}
      changeInfo={changeInfo}
      isNew={isNew || !!saveAsCopy}
      defaultValues={defaultValues}
      repository={repository}
      canPushToConfiguredBranch={canPushToConfiguredBranch}
      readOnly={readOnly}
      saveAsCopy={saveAsCopy}
    />
  );
}
