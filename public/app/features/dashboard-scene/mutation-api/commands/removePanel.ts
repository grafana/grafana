/**
 * REMOVE_PANEL command
 *
 * Remove an existing panel from the dashboard.
 * The panel is identified by its element name (key in the elements map).
 */

import { z } from 'zod';

import { DashboardScene } from '../../scene/DashboardScene';
import { getLayoutManagerFor, getVizPanelKeyForPanelId } from '../../utils/utils';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresNewDashboardLayouts, type MutationCommand } from './types';

export const removePanelPayloadSchema = payloads.removePanel;

export type RemovePanelPayload = z.infer<typeof removePanelPayloadSchema>;

export const removePanelCommand: MutationCommand<RemovePanelPayload> = {
  name: 'REMOVE_PANEL',
  description: payloads.removePanel.description ?? '',

  payloadSchema: payloads.removePanel,
  permission: requiresNewDashboardLayouts,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { element } = payload;
      const elementName = element.name;

      // Find the panel by element name
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- safe: mutation system only runs inside DashboardScene
      const dashScene = scene as unknown as DashboardScene;
      const panelId = dashScene.serializer.getPanelIdForElement(elementName);
      if (panelId === undefined) {
        throw new Error(`Element "${elementName}" not found in the dashboard`);
      }

      const expectedKey = getVizPanelKeyForPanelId(panelId);
      const allPanels = scene.state.body.getVizPanels();
      const vizPanel = allPanels.find((p) => p.state.key === expectedKey);
      if (!vizPanel) {
        throw new Error(`Panel with ID ${panelId} (element "${elementName}") not found in the layout`);
      }

      // Capture panel info before removal
      const previousValue = {
        title: vizPanel.state.title,
        pluginId: vizPanel.state.pluginId,
      };

      // Remove from the layout that contains this panel
      const layoutManager = getLayoutManagerFor(vizPanel);
      if (!layoutManager.removePanel) {
        throw new Error('Layout does not support panel removal');
      }
      layoutManager.removePanel(vizPanel);

      return {
        success: true,
        data: { element: elementName },
        changes: [
          {
            path: `/elements/${elementName}`,
            previousValue,
            newValue: undefined,
          },
        ],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  },
};
