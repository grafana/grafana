/**
 * REMOVE_PANEL command
 *
 * Remove a panel from the dashboard by element name or panel ID.
 * Captures the full PanelKind before removal for a structurally correct inverse mutation.
 */

import { z } from 'zod';

import { vizPanelToSchemaV2 } from '../../serialization/transformSceneToSaveModelSchemaV2';

import { findPanel } from './addPanel';
import { requiresEdit, type CommandDefinition } from './types';

const payloadSchema = z
  .object({
    elementName: z.string().optional().describe('Element name (e.g., "panel-1")'),
    panelId: z.number().optional().describe('Alternative: numeric panel ID'),
  })
  .refine((data) => data.elementName !== undefined || data.panelId !== undefined, {
    message: 'Either elementName or panelId must be provided',
  });

export type RemovePanelPayload = z.infer<typeof payloadSchema>;

export const removePanelCommand: CommandDefinition<RemovePanelPayload> = {
  name: 'REMOVE_PANEL',
  description: 'Remove a panel from the dashboard by element name or panel ID.',

  payloadSchema,
  permission: requiresEdit,

  handler: async (payload, context) => {
    const { scene, transaction } = context;
    const { elementName, panelId } = payload;

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
