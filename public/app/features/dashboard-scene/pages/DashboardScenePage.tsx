// Libraries
import React, { useEffect } from 'react';

import { PageLayoutType } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { DashboardPageRouteParams } from 'app/features/dashboard/containers/types';
import { DashboardRoutes } from 'app/types';

import { getDashboardScenePageStateManager } from './DashboardScenePageStateManager';

export interface Props extends GrafanaRouteComponentProps<DashboardPageRouteParams> {}

export function DashboardScenePage({ match, route }: Props) {
  const stateManager = getDashboardScenePageStateManager();
  const { dashboard, isLoading, loadError } = stateManager.useState();

  useEffect(() => {
    if (route.routeName === DashboardRoutes.Home) {
      stateManager.loadDashboard({ uid: route.routeName });
    } else {
      stateManager.loadDashboard({ uid: match.params.uid! });
    }

    return () => {
      stateManager.clearState();
    };
  }, [stateManager, match.params.uid, route.routeName]);

  if (!dashboard) {
    return (
      <Page layout={PageLayoutType.Canvas} data-testid={'dashboard-scene-page'}>
        {isLoading && <PageLoader />}
        {loadError && <h2>{loadError}</h2>}
      </Page>
    );
  }

  return <dashboard.Component model={dashboard} />;
}

export default DashboardScenePage;
