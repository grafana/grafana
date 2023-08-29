// Libraries
import React, { useEffect } from 'react';

import { PageLayoutType } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { getDashboardScenePageStateManager } from './DashboardScenePageStateManager';

export interface Props extends GrafanaRouteComponentProps<{ uid: string }> {}

export function DashboardScenePage({ match }: Props) {
  const stateManager = getDashboardScenePageStateManager();
  const { dashboard, isLoading } = stateManager.useState();

  useEffect(() => {
    stateManager.loadAndInit(match.params.uid);
    return () => {
      stateManager.clearState();
    };
  }, [stateManager, match.params.uid]);

  if (!dashboard) {
    return (
      <Page layout={PageLayoutType.Canvas}>
        {isLoading && <PageLoader />}
        {!isLoading && <h2>Dashboard not found</h2>}
      </Page>
    );
  }

  return <dashboard.Component model={dashboard} />;
}

export default DashboardScenePage;
