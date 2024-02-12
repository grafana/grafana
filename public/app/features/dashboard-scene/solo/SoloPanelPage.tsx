// Libraries
import React, { useEffect } from 'react';

import { Alert, Spinner } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { DashboardPageRouteParams } from 'app/features/dashboard/containers/types';
import { DashboardRoutes } from 'app/types';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';
import { DashboardScene } from '../scene/DashboardScene';

import { useSoloPanel } from './useSoloPanel';

export interface Props extends GrafanaRouteComponentProps<DashboardPageRouteParams, { panelId: string }> {}

/**
 * Used for iframe embedding and image rendering of single panels
 */
export function SoloPanelPage({ match, queryParams }: Props) {
  const stateManager = getDashboardScenePageStateManager();
  const { dashboard } = stateManager.useState();

  useEffect(() => {
    stateManager.loadDashboard({ uid: match.params.uid!, route: DashboardRoutes.Embedded });
    return () => stateManager.clearState();
  }, [stateManager, match, queryParams]);

  if (!queryParams.panelId) {
    return <EntityNotFound entity="Panel" />;
  }

  if (!dashboard) {
    return <PageLoader />;
  }

  return <SoloPanelRenderer dashboard={dashboard} panelId={queryParams.panelId} />;
}

export default SoloPanelPage;

export function SoloPanelRenderer({ dashboard, panelId }: { dashboard: DashboardScene; panelId: string }) {
  const [panel, error] = useSoloPanel(dashboard, panelId);

  if (error) {
    return <Alert title={error} />;
  }

  if (!panel) {
    return (
      <span>
        Loading <Spinner />
      </span>
    );
  }

  return (
    <div className="panel-solo">
      <panel.Component model={panel} />
    </div>
  );
}
