/**
 * MOVE_ROW command
 *
 * Reorder a row within its parent or move it to a different parent.
 */

import { type z } from 'zod';

import { dashboardEditActions } from '../../edit-pane/shared';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';

import { resolveLayoutPath, resolveParentPath } from './layoutPathResolver';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresNewDashboardLayouts, type MutationCommand } from './types';

const moveRowPayloadSchema = payloads.moveRow;

export type MoveRowPayload = z.infer<typeof moveRowPayloadSchema>;

export const moveRowCommand: MutationCommand<MoveRowPayload> = {
  name: 'MOVE_ROW',
  description: payloads.moveRow.description ?? '',

  payloadSchema: payloads.moveRow,
  permission: requiresNewDashboardLayouts,
  readOnly: false,

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

      const sourceRowsBefore = [...sourceParent.state.rows];
      const destRowsBefore = sourceParent === destParent ? sourceRowsBefore : [...destParent.state.rows];

      const sourceRowsAfter = [...sourceRowsBefore];
      sourceRowsAfter.splice(sourceSegment.index, 1);

      const destRowsAfter = sourceParent === destParent ? sourceRowsAfter : [...destRowsBefore];
      const insertIndex =
        toPosition !== undefined && toPosition >= 0 && toPosition <= destRowsAfter.length
          ? toPosition
          : destRowsAfter.length;
      destRowsAfter.splice(insertIndex, 0, row);

      const sameParent = sourceParent === destParent;

      dashboardEditActions.moveElement({
        movedObject: row,
        source: sourceParent,
        perform: () => {
          if (sameParent) {
            sourceParent.setState({ rows: destRowsAfter });
          } else {
            sourceParent.setState({ rows: sourceRowsAfter });
            destParent.setState({ rows: destRowsAfter });
          }
        },
        undo: () => {
          if (sameParent) {
            sourceParent.setState({ rows: sourceRowsBefore });
          } else {
            destParent.setState({ rows: destRowsBefore });
            sourceParent.setState({ rows: sourceRowsBefore });
          }
        },
      });

      const basePath = toParent ?? (path.substring(0, path.lastIndexOf('/rows/')) || '/');
      const newPath = basePath === '/' ? `/rows/${insertIndex}` : `${basePath}/rows/${insertIndex}`;

      const rowSpec = {
        title: row.state.title,
        collapse: row.state.collapse,
        hideHeader: row.state.hideHeader,
        fillScreen: row.state.fillScreen,
      };

      return {
        success: true,
        data: { path: newPath, row: { kind: 'RowsLayoutRow', spec: rowSpec } },
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
