/**
 * REMOVE_ROW command
 *
 * Remove a row by path. Optionally move contained panels to another group.
 */

import { z } from 'zod';

import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';

import { resolveLayoutPath, resolveParentPath } from './layoutPathResolver';
import { movePanelsToLayout } from './movePanelsHelper';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresNewDashboardLayouts, type MutationCommand } from './types';

export const removeRowPayloadSchema = payloads.removeRow;

export type RemoveRowPayload = z.infer<typeof removeRowPayloadSchema>;

export const removeRowCommand: MutationCommand<RemoveRowPayload> = {
  name: 'REMOVE_ROW',
  description: payloads.removeRow.description ?? '',

  payloadSchema: payloads.removeRow,
  permission: requiresNewDashboardLayouts,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { path, moveContentTo } = payload;

      if (moveContentTo === path) {
        throw new Error(`moveContentTo cannot be the same path as the row being removed`);
      }

      // Resolve the row to remove
      const resolved = resolveLayoutPath(scene.state.body, path);
      if (!(resolved.item instanceof RowItem)) {
        throw new Error(`Path "${path}" does not point to a row`);
      }

      const { parent, segment } = resolveParentPath(scene.state.body, path);
      if (!(parent instanceof RowsLayoutManager)) {
        throw new Error(`Parent of "${path}" is not a RowsLayoutManager`);
      }

      if (moveContentTo) {
        const panels = resolved.item.state.layout.getVizPanels();
        if (panels.length > 0) {
          const targetResolved = resolveLayoutPath(scene.state.body, moveContentTo);
          movePanelsToLayout(panels, targetResolved.layoutManager);
        }
      }

      // Remove the row
      const currentRows = [...parent.state.rows];
      currentRows.splice(segment.index, 1);
      parent.setState({ rows: currentRows });

      return {
        success: true,
        changes: [{ path, previousValue: { title: resolved.item.state.title }, newValue: undefined }],
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
