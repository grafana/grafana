// Libraries
import React, { useEffect } from 'react';

import { PageLayoutType } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { DashboardPageRouteParams } from 'app/features/dashboard/containers/types';
import { DashboardModel } from 'app/features/dashboard/state';
import { DashboardRoutes } from 'app/types';

import { getDashboardScenePageStateManager } from './DashboardScenePageStateManager';

export interface Props extends GrafanaRouteComponentProps<DashboardPageRouteParams> {
  preloadedDashboard?: DashboardModel;
}

export function DashboardScenePage({ match, route, preloadedDashboard }: Props) {
  const stateManager = getDashboardScenePageStateManager();
  const { dashboard, isLoading, loadError } = stateManager.useState();

  useEffect(() => {
    if (!preloadedDashboard) {
      if (route.routeName === DashboardRoutes.Home) {
        stateManager.loadDashboard(route.routeName);
      } else {
        stateManager.loadDashboard(match.params.uid);
      }
    }

    if (
      (preloadedDashboard && preloadedDashboard.uid === match.params.uid) ||
      (preloadedDashboard && preloadedDashboard.uid === null && route.routeName === DashboardRoutes.Home)
    ) {
      stateManager.loadSceneFromDashboardModel(preloadedDashboard, route.routeName === DashboardRoutes.Home);
    }

    return () => {
      stateManager.clearState();
    };
  }, [stateManager, match.params.uid, route.routeName, preloadedDashboard]);

  if (!dashboard) {
    return (
      <Page layout={PageLayoutType.Canvas}>
        {isLoading && <PageLoader />}
        {loadError && <h2>{loadError}</h2>}
      </Page>
    );
  }

  return <dashboard.Component model={dashboard} />;
}

export default DashboardScenePage;
