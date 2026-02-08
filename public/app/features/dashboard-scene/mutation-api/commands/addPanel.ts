/**
 * ADD_PANEL command
 *
 * Add a new panel to the dashboard. Creates both the panel definition
 * in elements and a layout item. Automatically generates a unique
 * element name and positions the panel.
 */

import { z } from 'zod';

import { VizPanel } from '@grafana/scenes';
import type { PanelKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { gridItemToGridLayoutItemKind } from '../../serialization/layoutSerializers/DefaultGridLayoutSerializer';
import { buildVizPanel } from '../../serialization/layoutSerializers/utils';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getVizPanelKeyForPanelId } from '../../utils/utils';

import { payloads } from './schemas';
import { requiresEdit, type MutationCommand } from './types';
import { validateDatasourceRefs, validatePluginId } from './validation';

export const addPanelPayloadSchema = payloads.addPanel;

export type AddPanelPayload = z.infer<typeof addPanelPayloadSchema>;

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

export const addPanelCommand: MutationCommand<AddPanelPayload> = {
  name: 'ADD_PANEL',
  description: payloads.addPanel.description ?? '',

  payloadSchema: payloads.addPanel,
  permission: requiresEdit,

  handler: async (payload, context) => {
    const { scene, transaction } = context;

    try {
      const body = scene.state.body;
      if (!body) {
        throw new Error('Dashboard has no body');
      }

      const pluginError = validatePluginId(payload.panel.spec.vizConfig.group);
      if (pluginError) {
        return { success: false, error: pluginError, changes: [] };
      }

      const dsError = validateDatasourceRefs(payload.panel.spec.data?.spec.queries);
      if (dsError) {
        return { success: false, error: dsError, changes: [] };
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
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Zod output is structurally compatible with PanelKind
      const vizPanel = buildVizPanel(panelKind as PanelKind, panelId);

      scene.addPanel(vizPanel);

      // Read the auto-calculated grid position from the parent DashboardGridItem
      const gridItem = vizPanel.parent;
      const layoutItem = gridItem instanceof DashboardGridItem ? gridItemToGridLayoutItemKind(gridItem) : undefined;

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
        data: { panelId, elementName, layoutItem },
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
