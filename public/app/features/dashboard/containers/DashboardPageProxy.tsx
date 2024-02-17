import React from 'react';
import { useAsync } from 'react-use';

import { config } from '@grafana/runtime';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import DashboardScenePage from 'app/features/dashboard-scene/pages/DashboardScenePage';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { DashboardRoutes } from 'app/types';

import DashboardPage from './DashboardPage';
import { DashboardPageRouteParams, DashboardPageRouteSearchParams } from './types';

export type DashboardPageProxyProps = GrafanaRouteComponentProps<
  DashboardPageRouteParams,
  DashboardPageRouteSearchParams
>;

// This proxy component is used for Dashboard -> Scenes migration.
// It will render DashboardScenePage if the user is only allowed to view the dashboard.
function DashboardPageProxy(props: DashboardPageProxyProps) {
  if (config.featureToggles.dashboardScene || props.queryParams.scenes) {
    return <DashboardScenePage {...props} />;
  }

  const stateManager = getDashboardScenePageStateManager();
  const isScenesSupportedRoute = Boolean(
    props.route.routeName === DashboardRoutes.Home ||
      (props.route.routeName === DashboardRoutes.Normal && props.match.params.uid)
  );

  // We pre-fetch dashboard to render dashboard page component depending on dashboard permissions.
  // To avoid querying single dashboard multiple times, stateManager.fetchDashboard uses a simple, short-lived cache.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const dashboard = useAsync(async () => {
    if (props.match.params.type === 'snapshot') {
      return null;
    }

    return stateManager.fetchDashboard({
      route: props.route.routeName as DashboardRoutes,
      uid: props.match.params.uid ?? '',
    });
  }, [props.match.params.uid, props.route.routeName]);

  if (!config.featureToggles.dashboardSceneForViewers) {
    return <DashboardPage {...props} />;
  }

  if (dashboard.loading) {
    return null;
  }

  if (
    dashboard.value &&
    !(dashboard.value.meta.canEdit || dashboard.value.meta.canMakeEditable) &&
    isScenesSupportedRoute
  ) {
    return <DashboardScenePage {...props} />;
  } else {
    return <DashboardPage {...props} />;
  }
}

export default DashboardPageProxy;
