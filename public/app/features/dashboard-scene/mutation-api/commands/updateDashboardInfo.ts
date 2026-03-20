/**
 * UPDATE_DASHBOARD_INFO command
 *
 * Partial update of dashboard title, description, and tags.
 * All fields are optional; only provided fields are applied.
 */

import { z } from 'zod';

import { debugLog } from '../debugLog';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';

export const updateDashboardInfoPayloadSchema = payloads.updateDashboardInfo;

export type UpdateDashboardInfoPayload = z.infer<typeof updateDashboardInfoPayloadSchema>;

export const updateDashboardInfoCommand: MutationCommand<UpdateDashboardInfoPayload> = {
  name: 'UPDATE_DASHBOARD_INFO',
  description: payloads.updateDashboardInfo.description ?? '',

  payloadSchema: payloads.updateDashboardInfo,
  permission: requiresEdit,

  handler: async (payload, context) => {
    const { scene } = context;

    enterEditModeIfNeeded(scene);
    debugLog('UPDATE_DASHBOARD_INFO', { payload });

    const changes = [];
    const update: Record<string, unknown> = {};

    if (payload.title !== undefined) {
      debugLog('updating title', { from: scene.state.title, to: payload.title });
      changes.push({ path: 'title', previousValue: scene.state.title, newValue: payload.title });
      update.title = payload.title;
    }

    if (payload.description !== undefined) {
      debugLog('updating description', { from: scene.state.description, to: payload.description });
      changes.push({ path: 'description', previousValue: scene.state.description, newValue: payload.description });
      update.description = payload.description;
    }

    if (payload.tags !== undefined) {
      debugLog('updating tags', { from: scene.state.tags, to: payload.tags });
      changes.push({ path: 'tags', previousValue: scene.state.tags, newValue: payload.tags });
      update.tags = payload.tags;
    }

    if (changes.length > 0) {
      scene.setState(update);
    }

    debugLog('UPDATE_DASHBOARD_INFO complete', { changeCount: changes.length });
    return { success: true, changes };
  },
};
