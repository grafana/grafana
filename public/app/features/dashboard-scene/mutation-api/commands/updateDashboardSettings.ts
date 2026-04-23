import { type z } from 'zod';

import { sceneGraph } from '@grafana/scenes';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';

export const updateDashboardSettingsPayloadSchema = payloads.updateDashboardSettings;

export type UpdateDashboardSettingsPayload = z.infer<typeof updateDashboardSettingsPayloadSchema>;

interface DashboardSettings {
  title: string;
  description: string;
  tags: string[];
  editable: boolean;
  refresh: string;
  timeRange: { from: string; to: string };
  timezone: string;
}

function readCurrentSettings(scene: Parameters<MutationCommand['handler']>[1]['scene']): DashboardSettings {
  const timeRange = sceneGraph.getTimeRange(scene);
  const refreshPicker = scene.state.controls?.state.refreshPicker;

  return {
    title: scene.state.title ?? '',
    description: scene.state.description ?? '',
    tags: scene.state.tags ?? [],
    editable: scene.state.editable ?? true,
    refresh: refreshPicker?.state.refresh ?? '',
    timeRange: {
      from: timeRange.state.from,
      to: timeRange.state.to,
    },
    timezone: timeRange.state.timeZone ?? '',
  };
}

export const updateDashboardSettingsCommand: MutationCommand<UpdateDashboardSettingsPayload> = {
  name: 'UPDATE_DASHBOARD_SETTINGS',
  description: payloads.updateDashboardSettings.description ?? '',

  payloadSchema: payloads.updateDashboardSettings,
  permission: requiresEdit,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const previousValue = readCurrentSettings(scene);
      const warnings: string[] = [];

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

      if (Object.keys(sceneUpdates).length > 0) {
        scene.setState(sceneUpdates);
      }

      const timeRange = sceneGraph.getTimeRange(scene);
      const timeRangeUpdates: Record<string, unknown> = {};
      if (payload.timeRange !== undefined) {
        timeRangeUpdates.from = payload.timeRange.from;
        timeRangeUpdates.to = payload.timeRange.to;
      }
      if (payload.timezone !== undefined) {
        timeRangeUpdates.timeZone = payload.timezone;
      }

      if (Object.keys(timeRangeUpdates).length > 0) {
        timeRange.setState(timeRangeUpdates);
      }

      if (payload.refresh !== undefined) {
        const refreshPicker = scene.state.controls?.state.refreshPicker;
        if (refreshPicker) {
          refreshPicker.setState({ refresh: payload.refresh });
        } else {
          warnings.push('refresh interval could not be set: refresh picker not found in scene controls');
        }
      }

      const newValue = readCurrentSettings(scene);

      return {
        success: true,
        data: newValue,
        changes: [{ previousValue, newValue }],
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
