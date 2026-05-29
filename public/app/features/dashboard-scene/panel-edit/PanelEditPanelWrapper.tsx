import { type VizPanel, useSceneObjectState } from '@grafana/scenes';

import { type DashboardScene } from '../scene/DashboardScene';
import { SoloPanelContextProvider, useDefineSoloPanelContext } from '../scene/SoloPanelContext';

interface PanelEditPanelWrapperProps {
  panel: VizPanel;
  tableView?: VizPanel;
  dashboard: DashboardScene;
}

export function PanelEditPanelWrapper({ panel, tableView, dashboard }: PanelEditPanelWrapperProps) {
  const soloPanelContext = useDefineSoloPanelContext(panel.getPathId());

  // This is to make sure the panel always remains active even when tableView is
  // rendered as the queries tab and other things subscribe / update panel state
  useSceneObjectState(panel, { shouldActivateOrKeepAlive: true });

  if (tableView) {
    return <tableView.Component model={tableView} />;
  }

  return (
    <SoloPanelContextProvider value={soloPanelContext!} singleMatch={true} dashboard={dashboard}>
      <dashboard.state.body.Component model={dashboard.state.body} />
    </SoloPanelContextProvider>
  );
}
