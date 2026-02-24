/**
 * MOVE_ROW command
 *
 * Reorder a row within its parent or move it to a different parent.
 */

import { z } from 'zod';

import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';

import { resolveLayoutPath, resolveParentPath } from './layoutPathResolver';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresNewDashboardLayouts, type MutationCommand } from './types';

export const moveRowPayloadSchema = payloads.moveRow;

export type MoveRowPayload = z.infer<typeof moveRowPayloadSchema>;

export const moveRowCommand: MutationCommand<MoveRowPayload> = {
  name: 'MOVE_ROW',
  description: payloads.moveRow.description ?? '',

  payloadSchema: payloads.moveRow,
  permission: requiresNewDashboardLayouts,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { path, toParent, toPosition } = payload;

      // Resolve the source row
      const resolved = resolveLayoutPath(scene.state.body, path);
      if (!(resolved.item instanceof RowItem)) {
        throw new Error(`Path "${path}" does not point to a row`);
      }

      const row = resolved.item;
      const { parent: sourceParent, segment: sourceSegment } = resolveParentPath(scene.state.body, path);

      if (!(sourceParent instanceof RowsLayoutManager)) {
        throw new Error(`Source parent of "${path}" is not a RowsLayoutManager`);
      }

      // Determine destination
      let destParent: RowsLayoutManager;
      if (toParent) {
        const destResolved = resolveLayoutPath(scene.state.body, toParent);
        if (!(destResolved.layoutManager instanceof RowsLayoutManager)) {
          throw new Error(`Destination "${toParent}" is not a RowsLayoutManager`);
        }
        destParent = destResolved.layoutManager;
      } else {
        destParent = sourceParent;
      }

      // Remove from source
      const sourceRows = [...sourceParent.state.rows];
      sourceRows.splice(sourceSegment.index, 1);
      sourceParent.setState({ rows: sourceRows });

      // Insert into destination
      const destRows = sourceParent === destParent ? sourceRows : [...destParent.state.rows];
      const insertIndex =
        toPosition !== undefined && toPosition >= 0 && toPosition <= destRows.length ? toPosition : destRows.length;
      destRows.splice(insertIndex, 0, row);
      destParent.setState({ rows: destRows });

      const basePath = toParent ?? (path.substring(0, path.lastIndexOf('/rows/')) || '/');
      const newPath = basePath === '/' ? `/rows/${insertIndex}` : `${basePath}/rows/${insertIndex}`;

      return {
        success: true,
        data: { path: newPath },
        changes: [{ path, previousValue: path, newValue: newPath }],
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
