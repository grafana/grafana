import { DashboardScene } from '../../scene/DashboardScene';
import { SaveDashboardDrawer } from '../SaveDashboardDrawer';
import { DashboardChangeInfo } from '../shared';

import { SaveProvisionedDashboardForm } from './SaveProvisionedDashboardForm';
import { useProvisionedDashboardData } from './hooks';

export interface SaveProvisionedDashboardProps {
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
}

export function SaveProvisionedDashboard({ drawer, changeInfo, dashboard }: SaveProvisionedDashboardProps) {
  const { isNew, defaultValues, loadedFromRef, isGitHub, workflowOptions, readOnly } =
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
      isGitHub={isGitHub}
      workflowOptions={workflowOptions}
      readOnly={readOnly}
    />
  );
}
