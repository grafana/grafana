/**
 * REMOVE_PANEL command
 *
 * Remove one or more panels from the dashboard by element name.
 */

import { z } from 'zod';

import { getElements } from '../../serialization/layoutSerializers/utils';
import { getLayoutManagerFor, getVizPanelKeyForPanelId } from '../../utils/utils';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';

export const removePanelPayloadSchema = payloads.removePanel;

export type RemovePanelPayload = z.infer<typeof removePanelPayloadSchema>;

export const removePanelCommand: MutationCommand<RemovePanelPayload> = {
  name: 'REMOVE_PANEL',
  description: payloads.removePanel.description ?? '',

  payloadSchema: payloads.removePanel,
  permission: requiresEdit,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { elements } = payload;
      const removed: string[] = [];
      const errors: string[] = [];
      const previousElements = new Map<string, unknown>();

      const fullElements = getElements(scene.state.body, scene);
      for (const element of elements) {
        const name = element.name;
        if (fullElements[name]) {
          previousElements.set(name, fullElements[name]);
        }
      }

      for (const element of elements) {
        const elementName = element.name;
        try {
          const panelId = scene.serializer.getPanelIdForElement(elementName);
          if (panelId === undefined) {
            errors.push(`Element "${elementName}" not found`);
            continue;
          }

          const expectedKey = getVizPanelKeyForPanelId(panelId);
          const allPanels = scene.state.body.getVizPanels();
          const vizPanel = allPanels.find((p) => p.state.key === expectedKey);

          if (!vizPanel) {
            errors.push(`Panel for element "${elementName}" not found in layout`);
            continue;
          }

          const layoutManager = getLayoutManagerFor(vizPanel);
          if (!layoutManager.removePanel) {
            errors.push(`Layout does not support panel removal for "${elementName}"`);
            continue;
          }

          layoutManager.removePanel(vizPanel);
          removed.push(elementName);
        } catch (err) {
          errors.push(`${elementName}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      if (errors.length > 0 && removed.length === 0) {
        return {
          success: false,
          error: `Failed to remove panels: ${errors.join('; ')}`,
          changes: [],
        };
      }

      return {
        success: true,
        data: { removed },
        changes: removed.map((name) => ({
          path: `/elements/${name}`,
          previousValue: previousElements.get(name) ?? null,
          newValue: null,
        })),
        warnings: errors.length > 0 ? errors.map((e) => `Partial failure: ${e}`) : undefined,
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
