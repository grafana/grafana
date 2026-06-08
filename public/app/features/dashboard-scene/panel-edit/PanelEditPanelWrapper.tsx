import { useMemo } from 'react';

import { type VizPanel } from '@grafana/scenes';

import { type DashboardScene } from '../scene/DashboardScene';
import { SoloPanelContextProvider, SoloPanelContextForPanelEdit } from '../scene/SoloPanelContext';

interface PanelEditPanelWrapperProps {
  panel: VizPanel;
  tableView?: VizPanel;
  dashboard: DashboardScene;
}

export function PanelEditPanelWrapper({ panel, tableView, dashboard }: PanelEditPanelWrapperProps) {
  const soloPanelContext = useMemo(() => new SoloPanelContextForPanelEdit(panel), [panel]);

  if (tableView) {
    return <tableView.Component model={tableView} />;
  }

  return (
    <SoloPanelContextProvider value={soloPanelContext} singleMatch={true} dashboard={dashboard}>
      <dashboard.state.body.Component model={dashboard.state.body} />
    </SoloPanelContextProvider>
  );
}
