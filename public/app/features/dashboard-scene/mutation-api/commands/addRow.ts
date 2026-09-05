/**
 * ADD_ROW command
 *
 * Add a new row to the dashboard layout. If the target parent is not a
 * RowsLayout, the existing content is nested inside the requested row
 * (preserving the original layout structure) rather than being flattened.
 */

import type * as z from 'zod';

import { ConditionalRenderingGroup } from '../../conditional-rendering/group/ConditionalRenderingGroup';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { isLayoutParent } from '../../scene/types/LayoutParent';
import { deserializeSectionVariables } from '../../serialization/layoutSerializers/sectionVariables';

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
          $variables: deserializeSectionVariables(row.spec.variables),
        });

        const currentRows = [...rowsManager.state.rows];
        newRowIndex =
          position !== undefined && position >= 0 && position <= currentRows.length ? position : currentRows.length;
        currentRows.splice(newRowIndex, 0, newRow);
        rowsManager.setState({ rows: currentRows });
      } else {
        const layoutParent = targetLayout.parent;
        if (!layoutParent || !isLayoutParent(layoutParent)) {
          throw new Error('Cannot convert layout: parent is not a LayoutParent');
        }

        // Nest the existing layout inside the requested row as-is, preserving its structure
        // (tabs, grid, etc.) — unless it is a section container with no sections, which has nothing
        // to preserve and nowhere to put a panel. The mirror of the same case in ADD_TAB.
        targetLayout.clearParent();
        const isEmptyContainer =
          (targetLayout instanceof RowsLayoutManager && targetLayout.state.rows.length === 0) ||
          (targetLayout instanceof TabsLayoutManager && targetLayout.state.tabs.length === 0);
        const preservesContent = !isEmptyContainer;

        const newRow = new RowItem({
          layout: preservesContent ? targetLayout : DefaultGridLayoutManager.fromVizPanels([]),
          title: row.spec.title,
          collapse: row.spec.collapse,
          hideHeader: row.spec.hideHeader,
          fillScreen: row.spec.fillScreen,
          repeatByVariable: row.spec.repeat?.value,
          conditionalRendering: row.spec.conditionalRendering
            ? ConditionalRenderingGroup.deserialize(row.spec.conditionalRendering)
            : undefined,
          $variables: deserializeSectionVariables(row.spec.variables),
        });

        rowsManager = new RowsLayoutManager({ rows: [newRow] });
        newRowIndex = 0;

        layoutParent.switchLayout(rowsManager);
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
