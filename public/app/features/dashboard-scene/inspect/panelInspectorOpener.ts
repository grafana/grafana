import { type VizPanel } from '@grafana/scenes';
import { type InspectTab } from 'app/features/inspector/types';

export async function openPanelInspector(panel: VizPanel, tab: InspectTab) {
  const [{ PanelInspectDrawer }, { getDashboardSceneFor }] = await Promise.all([
    import(/* webpackChunkName: "panel-inspect" */ './PanelInspectDrawer'),
    import('../utils/utils'),
  ]);

  getDashboardSceneFor(panel).showModal(new PanelInspectDrawer({ panelRef: panel.getRef(), currentTab: tab }));
}
