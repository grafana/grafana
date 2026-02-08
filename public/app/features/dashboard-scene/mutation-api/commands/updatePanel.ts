/**
 * UPDATE_PANEL command
 *
 * Update an existing panel's properties, queries, or configuration.
 * Only provided fields are changed.
 */

import { z } from 'zod';

import { PanelKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { createPanelDataProvider } from '../../serialization/layoutSerializers/utils';
import { vizPanelToSchemaV2 } from '../../serialization/transformSceneToSaveModelSchemaV2';
import { transformMappingsToV1 } from '../../serialization/transformToV1TypesUtils';

import { findPanel } from './addPanel';
import { panelSpecSchema } from './schemas';
import { requiresEdit, type CommandDefinition } from './types';

const payloadSchema = z
  .object({
    elementName: z.string().optional().describe('Element name to update'),
    panelId: z.number().optional().describe('Alternative: panel ID'),
    updates: panelSpecSchema.partial().describe('Partial panel spec with fields to update'),
  })
  .refine((data) => data.elementName !== undefined || data.panelId !== undefined, {
    message: 'Either elementName or panelId must be provided',
  });

export type UpdatePanelPayload = z.infer<typeof payloadSchema>;

export const updatePanelCommand: CommandDefinition<UpdatePanelPayload> = {
  name: 'UPDATE_PANEL',
  description: "Update an existing panel's properties, queries, or configuration. Only provided fields are changed.",

  payloadSchema,
  permission: requiresEdit,

  handler: async (payload, context) => {
    const { scene, transaction } = context;
    const { elementName, panelId, updates } = payload;

    try {
      const body = scene.state.body;
      if (!body) {
        throw new Error('Dashboard has no body');
      }

      const panels = body.getVizPanels();
      const panelToUpdate = findPanel(panels, elementName, panelId);

      if (!panelToUpdate) {
        throw new Error(`Panel not found: ${elementName ?? `panelId=${panelId}`}`);
      }

      // Capture previous state as schema-compatible PanelKind for inverse mutation
      const previousPanelKind = vizPanelToSchemaV2(panelToUpdate);

      // Build batched state updates
      const stateUpdate: Partial<Record<string, unknown>> = {};

      if (updates.title !== undefined) {
        stateUpdate.title = updates.title;
      }
      if (updates.description !== undefined) {
        stateUpdate.description = updates.description;
      }
      if (updates.transparent !== undefined) {
        stateUpdate.displayMode = updates.transparent ? 'transparent' : 'default';
      }

      if (updates.vizConfig !== undefined) {
        const vizConfig = updates.vizConfig;
        if (vizConfig.group !== undefined) {
          stateUpdate.pluginId = vizConfig.group;
        }
        if (vizConfig.version !== undefined) {
          stateUpdate.pluginVersion = vizConfig.version;
        }
        if (vizConfig.spec?.options !== undefined) {
          stateUpdate.options = {
            ...panelToUpdate.state.options,
            ...vizConfig.spec.options,
          };
        }
        if (vizConfig.spec?.fieldConfig !== undefined) {
          stateUpdate.fieldConfig = transformMappingsToV1(vizConfig.spec.fieldConfig);
        }
      }

      if (Object.keys(stateUpdate).length > 0) {
        panelToUpdate.setState(stateUpdate);
      }

      // Handle data updates using serialization utils
      if (updates.data !== undefined) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowing Element to PanelKind
        const currentPanelKind = vizPanelToSchemaV2(panelToUpdate) as PanelKind;
        const updatedPanelKind: PanelKind = {
          ...currentPanelKind,
          spec: { ...currentPanelKind.spec, data: updates.data },
        };
        const dataProvider = createPanelDataProvider(updatedPanelKind);
        panelToUpdate.setState({ $data: dataProvider });
      }

      const changes = [
        { path: `/elements/${elementName || panelId}`, previousValue: previousPanelKind, newValue: updates },
      ];
      transaction.changes.push(...changes);

      return {
        success: true,
        inverseMutation: {
          type: 'UPDATE_PANEL',
          payload: {
            elementName,
            panelId,
            updates: {
              title: previousPanelKind.kind === 'Panel' ? previousPanelKind.spec.title : undefined,
              description: previousPanelKind.kind === 'Panel' ? previousPanelKind.spec.description : undefined,
              transparent: previousPanelKind.kind === 'Panel' ? previousPanelKind.spec.transparent : undefined,
              vizConfig: previousPanelKind.kind === 'Panel' ? previousPanelKind.spec.vizConfig : undefined,
              data: previousPanelKind.kind === 'Panel' ? previousPanelKind.spec.data : undefined,
            },
          },
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
