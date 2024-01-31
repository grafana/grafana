// Libraries
import React, { useEffect } from 'react';

import { PageLayoutType } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { DashboardPageRouteParams, DashboardPageRouteSearchParams } from 'app/features/dashboard/containers/types';
import { DashboardRoutes } from 'app/types';

import { getDashboardScenePageStateManager } from './DashboardScenePageStateManager';

export interface Props extends GrafanaRouteComponentProps<DashboardPageRouteParams, DashboardPageRouteSearchParams> {}

export function DashboardScenePage({ match, route, queryParams }: Props) {
  const stateManager = getDashboardScenePageStateManager();
  const { dashboard, isLoading, loadError } = stateManager.useState();

  useEffect(() => {
    stateManager.loadDashboard({
      uid: match.params.uid ?? '',
      route: route.routeName as DashboardRoutes,
      urlFolderUid: queryParams.folderUid,
    });

    return () => {
      stateManager.clearState();
    };
  }, [stateManager, match.params.uid, route.routeName, queryParams.folderUid]);

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
