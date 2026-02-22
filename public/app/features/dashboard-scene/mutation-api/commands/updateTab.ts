/**
 * UPDATE_TAB command
 *
 * Update a tab's metadata (title) by path.
 */

import { z } from 'zod';

import { TabItem } from '../../scene/layout-tabs/TabItem';

import { resolveLayoutPath } from './layoutPathResolver';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresNewDashboardLayouts, type MutationCommand } from './types';

export const updateTabPayloadSchema = payloads.updateTab;

export type UpdateTabPayload = z.infer<typeof updateTabPayloadSchema>;

export const updateTabCommand: MutationCommand<UpdateTabPayload> = {
  name: 'UPDATE_TAB',
  description: payloads.updateTab.description ?? '',

  payloadSchema: payloads.updateTab,
  permission: requiresNewDashboardLayouts,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { path, spec } = payload;

      const resolved = resolveLayoutPath(scene.state.body, path);
      if (!(resolved.item instanceof TabItem)) {
        throw new Error(`Path "${path}" does not point to a tab`);
      }

      const tab = resolved.item;
      const previousValue = { title: tab.state.title };

      const updates: Record<string, unknown> = {};
      if (spec.title !== undefined) {
        updates.title = spec.title;
      }

      tab.setState(updates);

      if (spec.repeat !== undefined) {
        tab.onChangeRepeat(spec.repeat?.value || undefined);
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
