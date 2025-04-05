import { useUrlParams } from 'app/core/navigation/hooks';

import { DashboardScene } from '../../scene/DashboardScene';
import { SaveDashboardDrawer } from '../SaveDashboardDrawer';
import { DashboardChangeInfo } from '../shared';

import { SaveProvisionedDashboardForm } from './SaveProvisionedDashboardForm';
import { useDefaultValues } from './hooks';

export interface SaveProvisionedDashboardProps {
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
}

export function SaveProvisionedDashboard({ drawer, changeInfo, dashboard }: SaveProvisionedDashboardProps) {
  const { meta, title: defaultTitle, description: defaultDescription } = dashboard.useState();

  const [params] = useUrlParams();
  const loadedFromRef = params.get('ref') ?? undefined;

  const defaultValues = useDefaultValues({ meta, defaultTitle, defaultDescription });

  if (!defaultValues) {
    return null;
  }
  const { values, isNew, isGitHub, repository } = defaultValues;

  return (
    <SaveProvisionedDashboardForm
      dashboard={dashboard}
      drawer={drawer}
      changeInfo={changeInfo}
      isNew={isNew}
      defaultValues={values}
      loadedFromRef={loadedFromRef}
      isGitHub={isGitHub}
      repository={repository}
    />
  );
}
