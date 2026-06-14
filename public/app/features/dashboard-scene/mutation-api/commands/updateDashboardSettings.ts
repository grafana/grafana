import { type z } from 'zod';

import { t } from '@grafana/i18n';
import { sceneGraph } from '@grafana/scenes';

import { dashboardEditActions } from '../../edit-pane/shared';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';

const updateDashboardSettingsPayloadSchema = payloads.updateDashboardSettings;

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

      const sceneBefore = {
        title: scene.state.title,
        description: scene.state.description,
        tags: scene.state.tags,
        editable: scene.state.editable,
      };

      const timeRange = sceneGraph.getTimeRange(scene);
      const timeRangeUpdates: Record<string, unknown> = {};
      if (payload.timeRange !== undefined) {
        timeRangeUpdates.from = payload.timeRange.from;
        timeRangeUpdates.to = payload.timeRange.to;
      }
      if (payload.timezone !== undefined) {
        timeRangeUpdates.timeZone = payload.timezone;
      }

      const timeRangeBefore = {
        from: timeRange.state.from,
        to: timeRange.state.to,
        timeZone: timeRange.state.timeZone,
      };

      const refreshPicker = scene.state.controls?.state.refreshPicker;
      const refreshBefore = refreshPicker?.state.refresh;

      if (payload.refresh !== undefined && !refreshPicker) {
        warnings.push('refresh interval could not be set: refresh picker not found in scene controls');
      }

      dashboardEditActions.edit({
        description: t('dashboard.mutation-api.update-dashboard-settings', 'Update dashboard settings'),
        source: scene,
        perform: () => {
          if (Object.keys(sceneUpdates).length > 0) {
            scene.setState(sceneUpdates);
          }
          if (Object.keys(timeRangeUpdates).length > 0) {
            timeRange.setState(timeRangeUpdates);
          }
          if (payload.refresh !== undefined && refreshPicker) {
            refreshPicker.setState({ refresh: payload.refresh });
          }
        },
        undo: () => {
          scene.setState({
            title: sceneBefore.title,
            description: sceneBefore.description,
            tags: sceneBefore.tags,
            editable: sceneBefore.editable,
          });
          timeRange.setState({
            from: timeRangeBefore.from,
            to: timeRangeBefore.to,
            timeZone: timeRangeBefore.timeZone,
          });
          if (refreshPicker && refreshBefore !== undefined) {
            refreshPicker.setState({ refresh: refreshBefore });
          }
        },
      });

      const newValue = readCurrentSettings(scene);

      return {
        success: true,
        data: newValue,
        changes: [{ path: '', previousValue, newValue }],
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
