/**
 * UPDATE_ROW command
 *
 * Update a row's metadata (title, collapse, hideHeader, fillScreen) by path.
 */

import { type z } from 'zod';

import { t } from '@grafana/i18n';

import { ConditionalRenderingGroup } from '../../conditional-rendering/group/ConditionalRenderingGroup';
import { dashboardEditActions } from '../../edit-pane/shared';
import { RowItem } from '../../scene/layout-rows/RowItem';

import { resolveLayoutPath } from './layoutPathResolver';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresNewDashboardLayouts, type MutationCommand } from './types';

const updateRowPayloadSchema = payloads.updateRow;

export type UpdateRowPayload = z.infer<typeof updateRowPayloadSchema>;

export const updateRowCommand: MutationCommand<UpdateRowPayload> = {
  name: 'UPDATE_ROW',
  description: payloads.updateRow.description ?? '',

  payloadSchema: payloads.updateRow,
  permission: requiresNewDashboardLayouts,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { path, spec } = payload;

      const resolved = resolveLayoutPath(scene.state.body, path);
      if (!(resolved.item instanceof RowItem)) {
        throw new Error(`Path "${path}" does not point to a row`);
      }

      const row = resolved.item;
      const previousValue = {
        title: row.state.title,
        collapse: row.state.collapse,
        hideHeader: row.state.hideHeader,
        fillScreen: row.state.fillScreen,
        conditionalRendering: row.state.conditionalRendering?.serialize(),
      };

      const stateBefore = {
        title: row.state.title,
        collapse: row.state.collapse,
        hideHeader: row.state.hideHeader,
        fillScreen: row.state.fillScreen,
        repeatByVariable: row.state.repeatByVariable,
        repeatedRows: row.state.repeatedRows,
        $variables: row.state.$variables,
        conditionalRendering: row.state.conditionalRendering,
      };

      const updates: Record<string, unknown> = {};
      if (spec.title !== undefined) {
        updates.title = spec.title;
      }
      if (spec.collapse !== undefined) {
        updates.collapse = spec.collapse;
      }
      if (spec.hideHeader !== undefined) {
        updates.hideHeader = spec.hideHeader;
      }
      if (spec.fillScreen !== undefined) {
        updates.fillScreen = spec.fillScreen;
      }

      const newGroup =
        spec.conditionalRendering !== undefined
          ? ConditionalRenderingGroup.deserialize(spec.conditionalRendering)
          : undefined;

      dashboardEditActions.edit({
        description: t('dashboard.mutation-api.update-row', 'Update row'),
        source: row,
        perform: () => {
          if (Object.keys(updates).length > 0) {
            row.setState(updates);
          }
          if (spec.repeat !== undefined) {
            row.onChangeRepeat(spec.repeat?.value || undefined);
          }
          if (newGroup !== undefined) {
            row.setState({ conditionalRendering: newGroup });
          }
        },
        undo: () => {
          row.setState({
            title: stateBefore.title,
            collapse: stateBefore.collapse,
            hideHeader: stateBefore.hideHeader,
            fillScreen: stateBefore.fillScreen,
            repeatByVariable: stateBefore.repeatByVariable,
            repeatedRows: stateBefore.repeatedRows,
            $variables: stateBefore.$variables,
            conditionalRendering: stateBefore.conditionalRendering,
          });
        },
      });

      const currentSpec = {
        title: row.state.title,
        collapse: row.state.collapse,
        hideHeader: row.state.hideHeader,
        fillScreen: row.state.fillScreen,
        conditionalRendering: row.state.conditionalRendering?.serialize(),
      };

      return {
        success: true,
        data: { path, row: { kind: 'RowsLayoutRow', spec: currentSpec } },
        changes: [{ path, previousValue, newValue: currentSpec }],
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
