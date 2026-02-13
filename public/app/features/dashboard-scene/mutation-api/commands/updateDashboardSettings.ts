/**
 * UPDATE_DASHBOARD_SETTINGS command
 *
 * Update dashboard settings. Accepts any combination of metadata,
 * display options, links, and time settings. Only provided fields are changed.
 */

import { z } from 'zod';

import { sceneGraph, SceneRefreshPicker } from '@grafana/scenes';
import type { TimeSettingsSpec } from '@grafana/schema/src/schema/dashboard/v2beta1/types.spec.gen';

import { getCursorSync, getLiveNow } from './getDashboardSettings';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';

export const updateDashboardSettingsPayloadSchema = payloads.updateDashboardSettings;

export type UpdateDashboardSettingsPayload = z.infer<typeof updateDashboardSettingsPayloadSchema>;

export const updateDashboardSettingsCommand: MutationCommand<UpdateDashboardSettingsPayload> = {
  name: 'UPDATE_DASHBOARD_SETTINGS',
  description: payloads.updateDashboardSettings.description ?? '',

  payloadSchema: payloads.updateDashboardSettings,
  permission: requiresEdit,

  handler: async (payload, context) => {
    const { scene, transaction } = context;
    enterEditModeIfNeeded(scene);

    try {
      // Capture previous state for inverse mutation
      const previousState: UpdateDashboardSettingsPayload = {
        title: scene.state.title,
        description: scene.state.description,
        tags: scene.state.tags,
        editable: scene.state.editable,
        preload: scene.state.preload,
        liveNow: getLiveNow(scene),
        cursorSync: getCursorSync(scene),
        links: scene.state.links,
      };

      // Apply metadata updates to the scene
      const sceneUpdates: Record<string, unknown> = {};
      if (payload.title !== undefined) {
        sceneUpdates.title = payload.title;
      }
      if (payload.description !== undefined) {
        sceneUpdates.description = payload.description;
      }
      if (payload.tags !== undefined) {
        sceneUpdates.tags = payload.tags;
      }
      if (payload.editable !== undefined) {
        sceneUpdates.editable = payload.editable;
      }
      if (payload.links !== undefined) {
        sceneUpdates.links = payload.links;
      }

      if (Object.keys(sceneUpdates).length > 0) {
        scene.setState(sceneUpdates);
      }

      // Apply time settings if provided
      if (payload.timeSettings) {
        const { from, to, timezone, autoRefresh } = payload.timeSettings;

        const timeRange = scene.state.$timeRange;
        if (timeRange) {
          const previousTimeSettings: Partial<TimeSettingsSpec> = {
            from: timeRange.state.from,
            to: timeRange.state.to,
            timezone: timeRange.state.timeZone,
          };
          previousState.timeSettings = previousTimeSettings;

          const timeRangeUpdates: Record<string, unknown> = {};
          if (from !== undefined) {
            timeRangeUpdates.from = from;
          }
          if (to !== undefined) {
            timeRangeUpdates.to = to;
          }
          if (timezone !== undefined) {
            timeRangeUpdates.timeZone = timezone;
          }

          if (Object.keys(timeRangeUpdates).length > 0) {
            timeRange.setState(timeRangeUpdates);
          }
        }

        // Handle autoRefresh via SceneRefreshPicker
        if (autoRefresh !== undefined) {
          try {
            const refreshPicker = sceneGraph.findObject(scene, (obj) => obj instanceof SceneRefreshPicker);
            if (refreshPicker && refreshPicker instanceof SceneRefreshPicker) {
              if (previousState.timeSettings) {
                previousState.timeSettings.autoRefresh = refreshPicker.state.refresh;
              }
              refreshPicker.setState({ refresh: autoRefresh });
            }
          } catch {
            // SceneRefreshPicker may not exist
          }
        }
      }

      const changes = [{ path: '/', previousValue: previousState, newValue: payload }];
      transaction.changes.push(...changes);

      return {
        success: true,
        inverseMutation: {
          type: 'UPDATE_DASHBOARD_SETTINGS',
          payload: previousState,
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
