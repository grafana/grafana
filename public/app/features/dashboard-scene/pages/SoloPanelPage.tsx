// Libraries
import React, { useEffect } from 'react';

import { SceneComponentProps } from '@grafana/scenes';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { DashboardPageRouteParams } from 'app/features/dashboard/containers/types';

import { DashboardScene } from '../scene/DashboardScene';
import { findVizPanelByKey } from '../utils/utils';

import { getDashboardScenePageStateManager } from './DashboardScenePageStateManager';

export interface Props
  extends GrafanaRouteComponentProps<DashboardPageRouteParams, { panelId: string; timezone?: string }> {}

/**
 * Used for iframe embedding and image rendering of single panels
 */
export function SoloPanelPage({ match, queryParams }: Props) {
  const stateManager = getDashboardScenePageStateManager();
  const { dashboard } = stateManager.useState();

  useEffect(() => {
    stateManager.loadSoloPanel(match.params.uid!, queryParams.panelId, queryParams.timezone);
    return () => stateManager.clearState();
  }, [stateManager, match, queryParams]);

  if (!dashboard) {
    return <PageLoader />;
  }

  // Override the default rendering
  DashboardScene.Component = SoloPanelRenderer;

  return <dashboard.Component model={dashboard} />;
}

function SoloPanelRenderer({ model }: SceneComponentProps<DashboardScene>) {
  const { viewPanelKey } = model.useState();
  const panel = findVizPanelByKey(model, viewPanelKey);

  if (!panel) {
    return <div>Panel not found</div>;
  }

  return (
    <div className="panel-solo">
      <panel.Component model={panel} />
    </div>
  );
}

export default SoloPanelPage;
