import React from 'react';

import { contextSrv } from 'app/core/core';
import { SaveDashboardChangesAlert } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/ModalAlerts/SaveDashboardChangesAlert';
import { UnsupportedDataSourcesAlert } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/ModalAlerts/UnsupportedDataSourcesAlert';
import { UnsupportedTemplateVariablesAlert } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/ModalAlerts/UnsupportedTemplateVariablesAlert';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { AccessControlAction } from 'app/types';

import { useUnsupportedDatasources } from '../../public-dashboards/hooks';

export default function ShareAlerts({ dashboard }: { dashboard: DashboardScene }) {
  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);
  const unsupportedDataSources = useUnsupportedDatasources(dashboard);
  const hasTemplateVariables = (dashboard.state.$variables?.state.variables.length ?? 0) > 0;
  const showSaveChangesAlert = hasWritePermissions && dashboard.useState().isDirty;

  return (
    <>
      {hasWritePermissions && hasTemplateVariables && <UnsupportedTemplateVariablesAlert />}
      {hasWritePermissions && !!unsupportedDataSources?.length && (
        <UnsupportedDataSourcesAlert unsupportedDataSources={unsupportedDataSources.join(', ')} />
      )}
      {showSaveChangesAlert && <SaveDashboardChangesAlert />}
    </>
  );
}
