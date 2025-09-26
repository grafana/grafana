import { SaveDashboardDrawer } from 'app/features/dashboard-scene/saving/SaveDashboardDrawer';
import { DashboardChangeInfo } from 'app/features/dashboard-scene/saving/shared';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { useProvisionedDashboardData } from '../../hooks/useProvisionedDashboardData';

import { SaveProvisionedDashboardForm } from './SaveProvisionedDashboardForm';

export interface SaveProvisionedDashboardProps {
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
}

export function SaveProvisionedDashboard({ drawer, changeInfo, dashboard }: SaveProvisionedDashboardProps) {
  const { isNew, defaultValues, loadedFromRef, workflowOptions, readOnly, repository } =
    useProvisionedDashboardData(dashboard);

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
      repository={repository}
      workflowOptions={workflowOptions}
      readOnly={readOnly}
    />
  );
}
