/**
 * ADD_ROW command
 *
 * Add a new row to the dashboard layout. If the target parent is not a
 * RowsLayout, converts it (delegates to existing addNewRowTo logic).
 */

import { z } from 'zod';

import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { isLayoutParent } from '../../scene/types/LayoutParent';

import { resolveLayoutPath } from './layoutPathResolver';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresNewDashboardLayouts, type MutationCommand } from './types';

export const addRowPayloadSchema = payloads.addRow;

export type AddRowPayload = z.infer<typeof addRowPayloadSchema>;

export const addRowCommand: MutationCommand<AddRowPayload> = {
  name: 'ADD_ROW',
  description: payloads.addRow.description ?? '',

  payloadSchema: payloads.addRow,
  permission: requiresNewDashboardLayouts,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { row, parentPath, position } = payload;
      const resolved = resolveLayoutPath(scene.state.body, parentPath);
      const targetLayout = resolved.layoutManager;

      let rowsManager: RowsLayoutManager;
      let wasConverted = false;

      if (targetLayout instanceof RowsLayoutManager) {
        rowsManager = targetLayout;
      } else {
        // Convert to RowsLayout -- wrap existing layout in a row
        const layoutParent = targetLayout.parent;
        if (!layoutParent || !isLayoutParent(layoutParent)) {
          throw new Error('Cannot convert layout: parent is not a LayoutParent');
        }

        rowsManager = RowsLayoutManager.createFromLayout(targetLayout);
        layoutParent.switchLayout(rowsManager);
        wasConverted = true;
      }

      // Create the new row
      const newRow = new RowItem({
        layout: DefaultGridLayoutManager.fromVizPanels([]),
        title: row.spec.title,
        collapse: row.spec.collapse,
        hideHeader: row.spec.hideHeader,
        fillScreen: row.spec.fillScreen,
      });

      // Insert at position or append
      const currentRows = [...rowsManager.state.rows];
      const insertIndex =
        position !== undefined && position >= 0 && position <= currentRows.length ? position : currentRows.length;
      currentRows.splice(insertIndex, 0, newRow);
      rowsManager.setState({ rows: currentRows });

      const newPath = parentPath === '/' ? `/rows/${insertIndex}` : `${parentPath}/rows/${insertIndex}`;

      const warnings: string[] = [];
      if (wasConverted) {
        warnings.push(
          'Root layout converted to RowsLayout. Previous paths are invalidated; call GET_LAYOUT to refresh.'
        );
      }

      return {
        success: true,
        data: { path: newPath },
        changes: [{ path: newPath, previousValue: undefined, newValue: { title: row.spec.title } }],
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
