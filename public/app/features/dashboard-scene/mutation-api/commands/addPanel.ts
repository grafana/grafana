/**
 * ADD_PANEL command
 *
 * Add a new panel to the dashboard. Creates both the panel definition
 * in elements and a layout item. Automatically generates a unique
 * element name and positions the panel.
 */

import { z } from 'zod';

import { VizPanel } from '@grafana/scenes';

import { buildVizPanel } from '../../serialization/layoutSerializers/utils';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getVizPanelKeyForPanelId } from '../../utils/utils';

import { gridPositionSchema, panelKindSchema } from './shared';
import { requiresEdit, type CommandDefinition } from './types';

const payloadSchema = z.object({
  panel: panelKindSchema,
  position: gridPositionSchema.optional(),
});

export type AddPanelPayload = z.infer<typeof payloadSchema>;

/**
 * Find a panel by elementName or panelId in the dashboard body.
 */
export function findPanel(panels: VizPanel[], elementName?: string, panelId?: number): VizPanel | null {
  for (const panel of panels) {
    const state = panel.state;
    if (elementName && state.key === elementName) {
      return panel;
    }
    if (panelId !== undefined && state.key) {
      const keyMatch = String(state.key).match(/^panel-(\d+)$/);
      if (keyMatch && parseInt(keyMatch[1], 10) === panelId) {
        return panel;
      }
    }
  }
  return null;
}

export const addPanelCommand: CommandDefinition<AddPanelPayload> = {
  name: 'ADD_PANEL',
  description:
    'Add a new panel to the dashboard. Creates both the panel definition in elements and a layout item. Automatically generates a unique element name and positions the panel.',

  payloadSchema,
  permission: requiresEdit,

  handler: async (payload, context) => {
    const { scene, transaction } = context;

    try {
      const body = scene.state.body;
      if (!body) {
        throw new Error('Dashboard has no body');
      }

      const panelId = dashboardSceneGraph.getNextPanelId(scene);
      const elementName = getVizPanelKeyForPanelId(panelId);

      const panelKind = {
        ...payload.panel,
        spec: {
          ...payload.panel.spec,
          id: panelId,
          title: payload.panel.spec.title || 'New Panel',
          description: payload.panel.spec.description ?? '',
          links: payload.panel.spec.links ?? [],
          data: payload.panel.spec.data ?? {
            kind: 'QueryGroup' as const,
            spec: { queries: [], transformations: [], queryOptions: {} },
          },
        },
      };
      const vizPanel = buildVizPanel(panelKind, panelId);

      scene.addPanel(vizPanel);

      const changes = [
        {
          path: `/elements/${elementName}`,
          previousValue: undefined,
          newValue: { title: panelKind.spec.title, pluginId: panelKind.spec.vizConfig.group, panelId },
        },
      ];
      transaction.changes.push(...changes);

      return {
        success: true,
        data: { panelId, elementName },
        inverseMutation: {
          type: 'REMOVE_PANEL',
          payload: { elementName, panelId },
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
