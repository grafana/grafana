import React from 'react';

import { SceneComponentProps } from '@grafana/scenes';
import { CreatePublicDashboard as CreatePublicDashboardComponent } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/CreatePublicDashboard/CreatePublicDashboard';

import { SharePublicDashboardTab } from './SharePublicDashboardTab';
import { useUnsupportedDatasources } from './hooks';

export function CreatePublicDashboard({ model }: SceneComponentProps<SharePublicDashboardTab>) {
  const { isSaveLoading: isLoading, dashboardRef } = model.useState();

  const dashboard = dashboardRef.resolve();
  const unsupportedDataSources = useUnsupportedDatasources(dashboard);
  const hasTemplateVariables = (dashboard.state.$variables?.state.variables.length ?? 0) > 0;

  return (
    <CreatePublicDashboardComponent
      onCreate={model.onCreate}
      isLoading={isLoading}
      unsupportedDatasources={unsupportedDataSources}
      unsupportedTemplateVariables={hasTemplateVariables}
    />
  );
}
