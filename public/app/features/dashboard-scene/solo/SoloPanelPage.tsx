// Libraries
import React, { useEffect } from 'react';

import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { DashboardPageRouteParams } from 'app/features/dashboard/containers/types';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';

export interface Props
  extends GrafanaRouteComponentProps<DashboardPageRouteParams, { panelId: string; timezone?: string }> {}

/**
 * Used for iframe embedding and image rendering of single panels
 */
export function SoloPanelPage({ match, queryParams }: Props) {
  const stateManager = getDashboardScenePageStateManager();
  const { soloPanel } = stateManager.useState();

  useEffect(() => {
    stateManager.loadSoloPanel(match.params.uid!, queryParams.panelId, queryParams.timezone);
    return () => stateManager.clearState();
  }, [stateManager, match, queryParams]);

  if (!soloPanel) {
    return <PageLoader />;
  }

  return <soloPanel.Component model={soloPanel} />;
}

export default SoloPanelPage;
