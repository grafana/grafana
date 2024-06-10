import React from 'react';

import { SceneComponentProps } from '@grafana/scenes';
import { CreatePublicDashboardBase } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/CreatePublicDashboard/CreatePublicDashboard';

import { SharePublicDashboardTab } from './SharePublicDashboardTab';
import { useUnsupportedDatasources } from './hooks';

export function CreatePublicDashboard({ model }: SceneComponentProps<SharePublicDashboardTab>) {
  const { dashboardRef } = model.useState();
  const dashboard = dashboardRef.resolve();
  const unsupportedDataSources = useUnsupportedDatasources(dashboard);
  const hasTemplateVariables = (dashboard.state.$variables?.state.variables.length ?? 0) > 0;

  return (
    <CreatePublicDashboardBase
      dashboard={dashboard}
      unsupportedDatasources={unsupportedDataSources}
      unsupportedTemplateVariables={hasTemplateVariables}
    />
  );
}
