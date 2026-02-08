/**
 * GET_DASHBOARD_SETTINGS command
 *
 * Get all dashboard settings including metadata and time configuration.
 * Returns uid, title, description, tags, editable, preload, timeSettings,
 * canEdit, isEditing, and availableCommands.
 */

import { behaviors, sceneGraph, SceneRefreshPicker } from '@grafana/scenes';
import type {
  DashboardCursorSync,
  TimeSettingsSpec,
} from '@grafana/schema/src/schema/dashboard/v2beta1/types.spec.gen';

import { transformCursorSynctoEnum } from '../../serialization/transformToV2TypesUtils';

import { emptyPayloadSchema } from './schemas';
import { readOnly, type CommandDefinition } from './types';

function getCursorSync(scene: { state: { $behaviors?: unknown[] } }): DashboardCursorSync {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowing SceneBehavior[] to unknown[] for type guard
  const cursorSync = (scene.state.$behaviors as unknown[])?.find(
    (b): b is behaviors.CursorSync => b instanceof behaviors.CursorSync
  )?.state?.sync;

  return transformCursorSynctoEnum(cursorSync);
}

function getLiveNow(scene: { state: { $behaviors?: unknown[] } }): boolean | undefined {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowing SceneBehavior[] to unknown[] for type guard
  const liveNow = (scene.state.$behaviors as unknown[])?.find(
    (b): b is behaviors.LiveNowTimer => b instanceof behaviors.LiveNowTimer
  )?.isEnabled;

  return liveNow || undefined;
}

export const getDashboardSettingsCommand: CommandDefinition<Record<string, never>> = {
  name: 'GET_DASHBOARD_SETTINGS',
  description:
    'Get all dashboard settings including metadata and time configuration. Use this command to check the current dashboard state before making mutations.',

  payloadSchema: emptyPayloadSchema,
  permission: readOnly,

  handler: async (_payload, context) => {
    const { scene } = context;

    // Lazy import to avoid circular dependency
    const { ALL_COMMANDS } = await import('./registry');

    const timeRange = scene.state.$timeRange;
    const timeSettings: Partial<TimeSettingsSpec> = {};
    if (timeRange) {
      timeSettings.from = timeRange.state.from;
      timeSettings.to = timeRange.state.to;
      timeSettings.timezone = timeRange.state.timeZone;
    }
    try {
      const refreshPicker = sceneGraph.findObject(scene, (obj) => obj instanceof SceneRefreshPicker);
      if (refreshPicker && refreshPicker instanceof SceneRefreshPicker) {
        timeSettings.autoRefresh = refreshPicker.state.refresh;
      }
    } catch {
      // SceneRefreshPicker may not exist
    }

    const settings = {
      uid: scene.state.uid,
      title: scene.state.title,
      description: scene.state.description,
      tags: scene.state.tags,
      editable: scene.state.editable,
      preload: scene.state.preload,
      liveNow: getLiveNow(scene),
      cursorSync: getCursorSync(scene),
      links: scene.state.links,
      timeSettings,
      canEdit: scene.canEditDashboard(),
      isEditing: scene.state.isEditing ?? false,
      availableCommands: ALL_COMMANDS.map((cmd) => cmd.name),
    };

    return {
      success: true,
      changes: [],
      data: settings,
    };
  },
};
