// Libraries
import React, { useEffect } from 'react';

import { PageLayoutType } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { getDashboardSnapshotStateManager } from './DashboardSnapshotStateManager';

export interface Props extends GrafanaRouteComponentProps<{ uid: string }> {}

export function DashboardSnapshotPage({ match, route }: Props) {
  const stateManager = getDashboardSnapshotStateManager();
  const { dashboard, isLoading, loadError } = stateManager.useState();

  useEffect(() => {
    stateManager.loadSnapshot(match.params.uid);
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

export default DashboardSnapshotPage;
