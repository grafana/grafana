/**
 * UPDATE_DASHBOARD_INFO command
 *
 * Updates dashboard metadata (title, description, tags). All fields are
 * optional; only provided fields are applied. Requires edit permissions.
 */

import { z } from 'zod';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';

export const updateDashboardInfoPayloadSchema = payloads.updateDashboardInfo;

export type UpdateDashboardInfoPayload = z.infer<typeof updateDashboardInfoPayloadSchema>;

export const updateDashboardInfoCommand: MutationCommand<UpdateDashboardInfoPayload> = {
  name: 'UPDATE_DASHBOARD_INFO',
  description: payloads.updateDashboardInfo.description ?? '',

  payloadSchema: payloads.updateDashboardInfo,
  permission: requiresEdit,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const previousTitle = scene.state.title ?? '';
      const previousDescription = scene.state.description ?? '';
      const previousTags = scene.state.tags ?? [];

      const changes = [];

      if (payload.title !== undefined) {
        scene.setState({ title: payload.title });
        changes.push({
          path: '/title',
          previousValue: previousTitle,
          newValue: payload.title,
        });
      }

      if (payload.description !== undefined) {
        scene.setState({ description: payload.description });
        changes.push({
          path: '/description',
          previousValue: previousDescription,
          newValue: payload.description,
        });
      }

      if (payload.tags !== undefined) {
        scene.setState({ tags: payload.tags });
        changes.push({
          path: '/tags',
          previousValue: previousTags,
          newValue: payload.tags,
        });
      }

      return {
        success: true,
        data: {
          title: scene.state.title ?? '',
          description: scene.state.description ?? '',
          tags: scene.state.tags ?? [],
        },
        changes,
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
