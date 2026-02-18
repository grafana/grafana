/**
 * UPDATE_ROW command
 *
 * Update a row's metadata (title, collapse, hideHeader, fillScreen) by path.
 */

import { z } from 'zod';

import { RowItem } from '../../scene/layout-rows/RowItem';

import { resolveLayoutPath } from './layoutPathResolver';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresNewDashboardLayouts, type MutationCommand } from './types';

export const updateRowPayloadSchema = payloads.updateRow;

export type UpdateRowPayload = z.infer<typeof updateRowPayloadSchema>;

export const updateRowCommand: MutationCommand<UpdateRowPayload> = {
  name: 'UPDATE_ROW',
  description: payloads.updateRow.description ?? '',

  payloadSchema: payloads.updateRow,
  permission: requiresNewDashboardLayouts,

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

      row.setState(updates);

      if (spec.repeat !== undefined) {
        row.onChangeRepeat(spec.repeat?.value || undefined);
      }

      return {
        success: true,
        changes: [{ path, previousValue, newValue: updates }],
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
