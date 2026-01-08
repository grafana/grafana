import { SaveDashboardDrawer } from 'app/features/dashboard-scene/saving/SaveDashboardDrawer';
import { DashboardChangeInfo } from 'app/features/dashboard-scene/saving/shared';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { useProvisionedDashboardData } from '../../hooks/useProvisionedDashboardData';

import { SaveProvisionedDashboardForm } from './SaveProvisionedDashboardForm';

export interface SaveProvisionedDashboardProps {
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
  saveAsCopy?: boolean;
}

export function SaveProvisionedDashboard({ drawer, changeInfo, dashboard, saveAsCopy }: SaveProvisionedDashboardProps) {
  const { isNew, defaultValues, workflowOptions, readOnly, repository } = useProvisionedDashboardData(
    dashboard,
    saveAsCopy
  );

  if (!defaultValues) {
    return null;
  }

  return (
    <SaveProvisionedDashboardForm
      dashboard={dashboard}
      drawer={drawer}
      changeInfo={changeInfo}
      isNew={isNew || !!saveAsCopy}
      defaultValues={defaultValues}
      repository={repository}
      workflowOptions={workflowOptions}
      readOnly={readOnly}
      saveAsCopy={saveAsCopy}
    />
  );
}
