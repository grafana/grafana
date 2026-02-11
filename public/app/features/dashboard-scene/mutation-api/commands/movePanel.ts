/**
 * MOVE_PANEL command
 *
 * Move or resize an existing panel in the grid layout.
 * Updates the DashboardGridItem position (x, y, width, height).
 * Only provided fields are changed; omitted fields keep their current value.
 */

import { z } from 'zod';

import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { gridItemToGridLayoutItemKind } from '../../serialization/layoutSerializers/DefaultGridLayoutSerializer';

import { findPanel } from './addPanel';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';

export const movePanelPayloadSchema = payloads.movePanel;

export type MovePanelPayload = z.infer<typeof movePanelPayloadSchema>;

export const movePanelCommand: MutationCommand<MovePanelPayload> = {
  name: 'MOVE_PANEL',
  description: payloads.movePanel.description ?? '',

  payloadSchema: payloads.movePanel,
  permission: requiresEdit,

  handler: async (payload, context) => {
    const { scene, transaction } = context;
    const { elementName, position } = payload;
    enterEditModeIfNeeded(scene);

    try {
      const body = scene.state.body;
      if (!body) {
        throw new Error('Dashboard has no body');
      }

      const panels = body.getVizPanels();
      const panel = findPanel(panels, elementName);

      if (!panel) {
        throw new Error(`Panel not found: ${elementName}`);
      }

      const gridItem = panel.parent;
      if (!(gridItem instanceof DashboardGridItem)) {
        throw new Error(`Panel "${elementName}" is not in a grid layout`);
      }

      // Capture previous position for inverse mutation
      const previousPosition = {
        x: gridItem.state.x,
        y: gridItem.state.y,
        width: gridItem.state.width,
        height: gridItem.state.height,
      };

      // Apply new position, keeping current values for omitted fields
      gridItem.setState({
        x: position.x ?? gridItem.state.x,
        y: position.y ?? gridItem.state.y,
        width: position.width ?? gridItem.state.width,
        height: position.height ?? gridItem.state.height,
      });

      const layoutItem = gridItemToGridLayoutItemKind(gridItem);

      const changes = [{ path: `/layout/${elementName}`, previousValue: previousPosition, newValue: position }];
      transaction.changes.push(...changes);

      return {
        success: true,
        data: { layoutItem },
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
