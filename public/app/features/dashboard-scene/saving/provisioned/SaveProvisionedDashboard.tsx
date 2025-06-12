import { DashboardScene } from '../../scene/DashboardScene';
import { useProvisionedDashboardData } from '../../utils/useProvisionedDashboardData';
import { SaveDashboardDrawer } from '../SaveDashboardDrawer';
import { DashboardChangeInfo } from '../shared';

import { SaveProvisionedDashboardForm } from './SaveProvisionedDashboardForm';

export interface SaveProvisionedDashboardProps {
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
}

export function SaveProvisionedDashboard({ drawer, changeInfo, dashboard }: SaveProvisionedDashboardProps) {
  const { isNew, defaultValues, loadedFromRef, repository, isGitHub } = useProvisionedDashboardData(dashboard);

  if (!defaultValues) {
    return null;
  }

  return (
    <SaveProvisionedDashboardForm
      dashboard={dashboard}
      drawer={drawer}
      changeInfo={changeInfo}
      isNew={isNew}
      defaultValues={defaultValues}
      loadedFromRef={loadedFromRef}
      isGitHub={isGitHub}
      repository={repository}
    />
  );
}
