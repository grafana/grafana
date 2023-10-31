import React from 'react';

import { SceneComponentProps } from '@grafana/scenes';
import { useCreatePublicDashboardMutation } from 'app/features/dashboard/api/publicDashboardApi';
import { CreatePublicDashboard as CreatePublicDashboardComponent } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/CreatePublicDashboard/CreatePublicDashboard';
import { trackDashboardSharingActionPerType } from 'app/features/dashboard/components/ShareModal/analytics';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';

import { SharePublicDashboardTab } from './SharePublicDashboardTab';
import { useUnsupportedDatasources } from './hooks';

export function CreatePublicDashboard({ model }: SceneComponentProps<SharePublicDashboardTab>) {
  const { dashboardRef } = model.useState();
  const dashboard = dashboardRef.resolve();
  const [createPublicDashboard, { isLoading: isSaveLoading }] = useCreatePublicDashboardMutation();

  const unsupportedDataSources = useUnsupportedDatasources(dashboard);
  const hasTemplateVariables = (dashboard.state.$variables?.state.variables.length ?? 0) > 0;

  return (
    <CreatePublicDashboardComponent
      onCreate={() => {
        createPublicDashboard({ dashboard, payload: { isEnabled: true } });
        trackDashboardSharingActionPerType('generate_public_url', shareDashboardType.publicDashboard);
      }}
      isLoading={isSaveLoading}
      unsupportedDatasources={unsupportedDataSources}
      unsupportedTemplateVariables={hasTemplateVariables}
    />
  );
}
