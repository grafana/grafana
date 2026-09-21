import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { getPanelIdForVizPanel } from 'app/features/dashboard-scene/utils/utils-panels';

import { type PanelHandoff, type PanelResourceKind } from './handoffPrompt';

/**
 * Reads the handoff out of a live panel, so the menu and the setup drawer describe
 * the same panel rather than each assembling their own idea of it.
 */
export function panelHandoffFor(
  panel: VizPanel,
  resourceUid: string,
  resourceKind: PanelResourceKind = 'dashboard'
): PanelHandoff {
  const timeRange = sceneGraph.getTimeRange(panel).state.value;

  return {
    resourceKind,
    resourceUid,
    panelId: getPanelIdForVizPanel(panel),
    panelTitle: panel.state.title,
    panelType: panel.state.pluginId,
    // The raw range rather than the resolved instants: `now-6h` has to stay relative
    // so the agent's own re-query follows the window instead of freezing it.
    from: String(timeRange.raw.from),
    to: String(timeRange.raw.to),
  };
}
