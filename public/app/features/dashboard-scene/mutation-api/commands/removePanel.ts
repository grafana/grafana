/**
 * REMOVE_PANEL command
 *
 * Remove a panel from the dashboard by element name or panel ID.
 * Captures the full PanelKind before removal for a structurally correct inverse mutation.
 */

import { z } from 'zod';

import { vizPanelToSchemaV2 } from '../../serialization/transformSceneToSaveModelSchemaV2';

import { findPanel } from './addPanel';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';

export const removePanelPayloadSchema = payloads.removePanel;

export type RemovePanelPayload = z.infer<typeof removePanelPayloadSchema>;

export const removePanelCommand: MutationCommand<RemovePanelPayload> = {
  name: 'REMOVE_PANEL',
  description: payloads.removePanel.description ?? '',

  payloadSchema: payloads.removePanel,
  permission: requiresEdit,

  handler: async (payload, context) => {
    const { scene, transaction } = context;
    const { elementName, panelId } = payload;
    enterEditModeIfNeeded(scene);

    try {
      const body = scene.state.body;
      if (!body) {
        throw new Error('Dashboard has no body');
      }

      const panels = body.getVizPanels();
      const panelToRemove = findPanel(panels, elementName, panelId);

      if (!panelToRemove) {
        throw new Error(`Panel not found: ${elementName ?? `panelId=${panelId}`}`);
      }

      const panelKind = vizPanelToSchemaV2(panelToRemove);

      scene.removePanel(panelToRemove);

      const changes = [{ path: `/elements/${elementName || panelId}`, previousValue: panelKind, newValue: undefined }];
      transaction.changes.push(...changes);

      return {
        success: true,
        inverseMutation: {
          type: 'ADD_PANEL',
          payload: { panel: panelKind },
        },
        changes,
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
