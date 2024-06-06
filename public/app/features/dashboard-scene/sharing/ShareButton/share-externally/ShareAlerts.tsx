import React from 'react';

import { contextSrv } from 'app/core/core';
import { EmailSharingPricingAlert } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/ModalAlerts/EmailSharingPricingAlert';
import { UnsupportedDataSourcesAlert } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/ModalAlerts/UnsupportedDataSourcesAlert';
import { UnsupportedTemplateVariablesAlert } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/ModalAlerts/UnsupportedTemplateVariablesAlert';
import {
  isEmailSharingEnabled,
  PublicDashboard,
  PublicDashboardShareType,
} from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { AccessControlAction } from 'app/types';

import { useUnsupportedDatasources } from '../../public-dashboards/hooks';

export default function ShareAlerts({
  dashboard,
  publicDashboard,
}: {
  dashboard: DashboardScene;
  publicDashboard?: PublicDashboard;
}) {
  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);
  const unsupportedDataSources = useUnsupportedDatasources(dashboard);
  const hasTemplateVariables = (dashboard.state.$variables?.state.variables.length ?? 0) > 0;

  return (
    <>
      {hasWritePermissions && hasTemplateVariables && <UnsupportedTemplateVariablesAlert showDescription={false} />}
      {hasWritePermissions && !!unsupportedDataSources?.length && (
        <UnsupportedDataSourcesAlert unsupportedDataSources={unsupportedDataSources.join(', ')} />
      )}
      {publicDashboard?.share === PublicDashboardShareType.EMAIL && isEmailSharingEnabled && (
        <EmailSharingPricingAlert />
      )}
    </>
  );
}
