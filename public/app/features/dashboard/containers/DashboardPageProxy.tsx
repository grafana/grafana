import React from 'react';

import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import DashboardScenePage from 'app/features/dashboard-scene/pages/DashboardScenePage';
import { AccessControlAction } from 'app/types';

import DashboardPage from './DashboardPage';
import { DashboardPageRouteParams, DashboardPageRouteSearchParams } from './types';

type Props = GrafanaRouteComponentProps<DashboardPageRouteParams, DashboardPageRouteSearchParams>;

// This proxy component is used for Dashboard -> Scenes migration.
// It will render DashboardScenePage if user does not have write permissions to a dashboard.
function DashboardPageProxy(props: Props) {
  if (config.featureToggles.dashboardSceneForViewers) {
    if (contextSrv.hasPermission(AccessControlAction.DashboardsWrite)) {
      return <DashboardPage {...props} />;
    } else {
      return <DashboardScenePage {...props} />;
    }
  }

  return <DashboardPage {...props} />;
}

export default DashboardPageProxy;
