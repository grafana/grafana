// Libraries
import React, { useEffect } from 'react';

import { SceneComponentProps } from '@grafana/scenes';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { useUrlParams } from 'app/core/navigation/hooks';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { DashboardPageRouteParams } from 'app/features/dashboard/containers/types';
import { DashboardRoutes } from 'app/types';

import { DashboardScene } from '../scene/DashboardScene';
import { findVizPanelByKey } from '../utils/utils';

import { getDashboardScenePageStateManager } from './DashboardScenePageStateManager';

export interface Props extends GrafanaRouteComponentProps<DashboardPageRouteParams> {}

/**
 * Used for iframe embedding and image rendering of single panels
 */
export function SoloPanelPage({ match, route }: Props) {
  const stateManager = getDashboardScenePageStateManager();
  const { dashboard } = stateManager.useState();

  useEffect(() => {
    if (route.routeName === DashboardRoutes.Home) {
      stateManager.loadDashboard(route.routeName);
    } else {
      stateManager.loadDashboard(match.params.uid!);
    }

    return () => {
      stateManager.clearState();
    };
  }, [stateManager, match.params.uid, route.routeName]);

  if (!dashboard) {
    return <PageLoader />;
  }

  DashboardScene.Component = SoloPanelRenderer;

  return <SoloPanelRenderer model={dashboard} />;
}

export function SoloPanelRenderer({ model }: SceneComponentProps<DashboardScene>) {
  const [params] = useUrlParams();
  const panel = findVizPanelByKey(model, params.get('panelId') ?? '');

  if (!panel) {
    return <div>Panel not found</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <panel.Component model={panel} />
    </div>
  );
}

export default SoloPanelPage;
