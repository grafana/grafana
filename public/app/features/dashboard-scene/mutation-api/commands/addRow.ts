/**
 * ADD_ROW command
 *
 * Add a new row to the dashboard layout. If the target parent is not a
 * RowsLayout, the existing content is nested inside the requested row
 * (preserving the original layout structure) rather than being flattened.
 */

import { type z } from 'zod';

import { ConditionalRenderingGroup } from '../../conditional-rendering/group/ConditionalRenderingGroup';
import { dashboardEditActions } from '../../edit-pane/shared';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { isLayoutParent } from '../../scene/types/LayoutParent';

import { resolveLayoutPath, validateNesting } from './layoutPathResolver';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresNewDashboardLayouts, type MutationCommand } from './types';

const addRowPayloadSchema = payloads.addRow;

export type AddRowPayload = z.infer<typeof addRowPayloadSchema>;

export const addRowCommand: MutationCommand<AddRowPayload> = {
  name: 'ADD_ROW',
  description: payloads.addRow.description ?? '',

  payloadSchema: payloads.addRow,
  permission: requiresNewDashboardLayouts,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { row, parentPath, position } = payload;
      const resolved = resolveLayoutPath(scene.state.body, parentPath);
      const targetLayout = resolved.layoutManager;

      let rowsManager: RowsLayoutManager;
      let wasConverted = false;
      let newRowIndex: number;

      validateNesting(parentPath, 'rows', targetLayout);

      if (targetLayout instanceof RowsLayoutManager) {
        rowsManager = targetLayout;
        const localRowsManager = rowsManager;

        const newRow = new RowItem({
          layout: DefaultGridLayoutManager.fromVizPanels([]),
          title: row.spec.title,
          collapse: row.spec.collapse,
          hideHeader: row.spec.hideHeader,
          fillScreen: row.spec.fillScreen,
          repeatByVariable: row.spec.repeat?.value,
          conditionalRendering: row.spec.conditionalRendering
            ? ConditionalRenderingGroup.deserialize(row.spec.conditionalRendering)
            : undefined,
        });

        const rowsBefore = [...localRowsManager.state.rows];
        const rowsAfter = [...rowsBefore];
        newRowIndex =
          position !== undefined && position >= 0 && position <= rowsAfter.length ? position : rowsAfter.length;
        rowsAfter.splice(newRowIndex, 0, newRow);

        dashboardEditActions.addElement({
          addedObject: newRow,
          source: localRowsManager,
          perform: () => localRowsManager.setState({ rows: rowsAfter }),
          undo: () => localRowsManager.setState({ rows: rowsBefore }),
        });
      } else {
        const layoutParent = targetLayout.parent;
        if (!layoutParent || !isLayoutParent(layoutParent)) {
          throw new Error('Cannot convert layout: parent is not a LayoutParent');
        }

        const previousLayoutClone = targetLayout.clone({});

        // Nest the existing layout inside the requested row as-is,
        // preserving its structure (tabs, grid, etc.).
        targetLayout.clearParent();
        const newRow = new RowItem({
          layout: targetLayout,
          title: row.spec.title,
          collapse: row.spec.collapse,
          hideHeader: row.spec.hideHeader,
          fillScreen: row.spec.fillScreen,
          repeatByVariable: row.spec.repeat?.value,
          conditionalRendering: row.spec.conditionalRendering
            ? ConditionalRenderingGroup.deserialize(row.spec.conditionalRendering)
            : undefined,
        });

        rowsManager = new RowsLayoutManager({ rows: [newRow] });
        newRowIndex = 0;
        const newRowsManager = rowsManager;

        dashboardEditActions.addElement({
          addedObject: newRow,
          source: scene,
          perform: () => layoutParent.switchLayout(newRowsManager),
          undo: () => layoutParent.switchLayout(previousLayoutClone),
        });
        wasConverted = true;
      }

      const newPath = parentPath === '/' ? `/rows/${newRowIndex}` : `${parentPath}/rows/${newRowIndex}`;

      const warnings: string[] = [];
      if (wasConverted) {
        warnings.push(
          'Root layout converted to RowsLayout. Previous paths are invalidated; call GET_LAYOUT to refresh.'
        );
      }

      return {
        success: true,
        data: { path: newPath, row: { kind: 'RowsLayoutRow', spec: row.spec } },
        changes: [{ path: newPath, previousValue: null, newValue: { title: row.spec.title } }],
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
