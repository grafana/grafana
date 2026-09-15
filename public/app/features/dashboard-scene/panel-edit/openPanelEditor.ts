import { type VizPanel } from '@grafana/scenes';

import { type DashboardScene } from '../scene/DashboardScene';

/**
 * Enters panel edit for `panel`.
 *
 * The panel editor pulls in the options pane, the data pane and the alerting tab — over a
 * megabyte that most sessions never render — so it is fetched on demand instead of being part
 * of the initial bundle. Callers must therefore not assume `dashboard.state.editPanel` is set
 * by the time this returns.
 */
export async function openPanelEditor(dashboard: DashboardScene, panel: VizPanel, isNewPanel = false) {
  // Guard all editor entry points, including URLs and keyboard shortcuts. The editor
  // adds a default query to empty panels, which is incompatible with plan placeholders.
  if (!dashboard.isPlanningActionAllowed('edit-panel')) {
    return;
  }

  const { buildPanelEditScene } = await import(/* webpackChunkName: "panel-edit" */ './PanelEditor');
  dashboard.setState({ editPanel: buildPanelEditScene(panel, isNewPanel) });
}
