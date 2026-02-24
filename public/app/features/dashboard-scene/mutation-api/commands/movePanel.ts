/**
 * MOVE_PANEL command
 *
 * Move an existing panel to a different group (row/tab) and/or grid position.
 * The panel is identified by its element name (key in the elements map).
 */

import { z } from 'zod';

import type { VizPanel } from '@grafana/scenes';

import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { getLayoutManagerFor, getVizPanelKeyForPanelId } from '../../utils/utils';

import { resolveLayoutPath } from './layoutPathResolver';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresNewDashboardLayouts, type MutationCommand } from './types';

export const movePanelPayloadSchema = payloads.movePanel;

export type MovePanelPayload = z.infer<typeof movePanelPayloadSchema>;

/**
 * Apply grid position fields to the DashboardGridItem wrapping a panel.
 * Only updates fields that are explicitly provided (partial update).
 * Silently no-ops if the panel is not inside a DashboardGridItem (e.g. AutoGridItem).
 */
function applyGridPosition(
  panel: VizPanel,
  position: { x?: number; y?: number; width?: number; height?: number }
): void {
  const gridItem = panel.parent;
  if (!(gridItem instanceof DashboardGridItem)) {
    return;
  }

  const updates: Record<string, number> = {};
  if (position.x !== undefined) {
    updates.x = position.x;
  }
  if (position.y !== undefined) {
    updates.y = position.y;
  }
  if (position.width !== undefined) {
    updates.width = position.width;
  }
  if (position.height !== undefined) {
    updates.height = position.height;
  }

  if (Object.keys(updates).length > 0) {
    gridItem.setState(updates);
  }
}

export const movePanelCommand: MutationCommand<MovePanelPayload> = {
  name: 'MOVE_PANEL',
  description: payloads.movePanel.description ?? '',

  payloadSchema: payloads.movePanel,
  permission: requiresNewDashboardLayouts,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { element, toParent, position } = payload;
      const elementName = element.name;

      const panelId = scene.serializer.getPanelIdForElement(elementName);
      if (panelId === undefined) {
        throw new Error(`Element "${elementName}" not found in the dashboard`);
      }

      // Find the VizPanel matching this ID using the canonical key format
      const expectedKey = getVizPanelKeyForPanelId(panelId);
      const allPanels = scene.state.body.getVizPanels();
      const vizPanel = allPanels.find((p) => p.state.key === expectedKey);
      if (!vizPanel) {
        throw new Error(`Panel with ID ${panelId} (element "${elementName}") not found in the layout`);
      }

      if (!toParent) {
        // Same-group repositioning
        if (position) {
          applyGridPosition(vizPanel, position);
        }
        return {
          success: true,
          data: { element: elementName, parent: 'current' },
          changes: position
            ? [{ path: `/elements/${elementName}/position`, previousValue: 'previous', newValue: position }]
            : [],
        };
      }

      // Resolve target
      const targetResolved = resolveLayoutPath(scene.state.body, toParent);
      const targetLayout = targetResolved.layoutManager;

      // Capture original grid dimensions before the panel is removed
      const sourceGridItem = vizPanel.parent;
      const originalSize =
        sourceGridItem instanceof DashboardGridItem
          ? { width: sourceGridItem.state.width, height: sourceGridItem.state.height }
          : undefined;

      // Clone the panel, remove from owning layout, add to target
      const panelClone = vizPanel.clone();

      // Remove from the layout that actually contains this panel
      const currentLayout = getLayoutManagerFor(vizPanel);
      if (!currentLayout.removePanel) {
        throw new Error('Source layout does not support panel removal');
      }
      currentLayout.removePanel(vizPanel);

      // Add to target layout
      targetLayout.addPanel(panelClone);

      // Restore original dimensions when no explicit position is provided
      const warnings: string[] = [];
      if (position) {
        if (targetLayout instanceof AutoGridLayoutManager) {
          warnings.push('Position ignored: target uses AutoGridLayout which auto-arranges panels.');
        } else {
          applyGridPosition(panelClone, position);
        }
      } else if (originalSize && !(targetLayout instanceof AutoGridLayoutManager)) {
        applyGridPosition(panelClone, originalSize);
      }

      return {
        success: true,
        data: { element: elementName, parent: toParent },
        changes: [
          {
            path: `/elements/${elementName}`,
            previousValue: { parent: 'previous' },
            newValue: { parent: toParent },
          },
        ],
        warnings: warnings.length > 0 ? warnings : undefined,
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
