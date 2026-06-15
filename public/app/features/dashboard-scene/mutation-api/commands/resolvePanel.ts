import { type VizPanel } from '@grafana/scenes';

import { type DashboardScene } from '../../scene/DashboardScene';
import { getVizPanelKeyForPanelId } from '../../utils/utils';

/**
 * Resolves an element name (as used in the mutation-api payloads) to the actual
 * VizPanel in the scene. Throws if the element or panel cannot be found.
 */
export function resolvePanelByElementName(scene: DashboardScene, elementName: string): VizPanel {
  const panelId = scene.serializer.getPanelIdForElement(elementName);
  if (panelId === undefined) {
    throw new Error(`Element "${elementName}" not found in the dashboard`);
  }

  const expectedKey = getVizPanelKeyForPanelId(panelId);
  const panel = scene.state.body.getVizPanels().find((p) => p.state.key === expectedKey);
  if (!panel) {
    throw new Error(`Panel for element "${elementName}" not found in the layout`);
  }

  return panel;
}
