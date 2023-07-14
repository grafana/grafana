import React from 'react';

import { VizPanel } from '@grafana/scenes';
import { Drawer } from '@grafana/ui';

import { DashboardScene } from './DashboardScene';

interface Props {
  dashboard: DashboardScene;
  panel: VizPanel;
}

export const ScenePanelInspector = React.memo<Props>(({ panel, dashboard }) => {
  return (
    <Drawer
      title={`Inspect: ${panel.state.title}`}
      scrollableContent
      onClose={dashboard.onCloseInspectDrawer}
      size="md"
    >
      Magic content
    </Drawer>
  );
});

ScenePanelInspector.displayName = 'ScenePanelInspector';
