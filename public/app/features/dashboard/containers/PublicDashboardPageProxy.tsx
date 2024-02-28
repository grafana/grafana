import React from 'react';

import { config } from '@grafana/runtime';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { PublicDashboardScenePage } from '../../dashboard-scene/pages/PublicDashboardScenePage';

import PublicDashboardPage from './PublicDashboardPage';
import { PublicDashboardPageRouteParams, PublicDashboardPageRouteSearchParams } from './types';

export type PublicDashboardPageProxyProps = GrafanaRouteComponentProps<
  PublicDashboardPageRouteParams,
  PublicDashboardPageRouteSearchParams
>;

function PublicDashboardPageProxy(props: PublicDashboardPageProxyProps) {
  if (config.featureToggles.dashboardScene || props.queryParams.scenes) {
    return <PublicDashboardScenePage {...props} />;
  }

  return <PublicDashboardPage {...props} />;
}

export default PublicDashboardPageProxy;
