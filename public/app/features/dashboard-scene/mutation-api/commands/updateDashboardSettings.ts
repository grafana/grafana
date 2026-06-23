import { type z } from 'zod';

import { textUtil } from '@grafana/data';
import { behaviors, sceneGraph } from '@grafana/scenes';
import { DashboardCursorSync, type DashboardLink } from '@grafana/schema';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';

const updateDashboardSettingsPayloadSchema = payloads.updateDashboardSettings;

export type UpdateDashboardSettingsPayload = z.infer<typeof updateDashboardSettingsPayloadSchema>;

type CursorSyncValue = NonNullable<UpdateDashboardSettingsPayload['cursorSync']>;
type DashboardLinkPayload = NonNullable<UpdateDashboardSettingsPayload['links']>[number];

const CURSOR_SYNC_TO_ENUM: Record<CursorSyncValue, DashboardCursorSync> = {
  Off: DashboardCursorSync.Off,
  Crosshair: DashboardCursorSync.Crosshair,
  Tooltip: DashboardCursorSync.Tooltip,
};

function cursorSyncToString(sync?: DashboardCursorSync): CursorSyncValue {
  switch (sync) {
    case DashboardCursorSync.Crosshair:
      return 'Crosshair';
    case DashboardCursorSync.Tooltip:
      return 'Tooltip';
    default:
      return 'Off';
  }
}

// The payload links are partial; fill the full DashboardLink shape and sanitize
// the URL since these render as clickable links and the input is model-controlled.
function normalizeDashboardLink(link: DashboardLinkPayload): DashboardLink {
  return {
    title: link.title,
    url: link.url ? textUtil.sanitizeUrl(link.url) : '',
    type: link.type ?? 'link',
    tooltip: link.tooltip ?? '',
    icon: link.icon ?? '',
    tags: link.tags ?? [],
    asDropdown: link.asDropdown ?? false,
    targetBlank: link.targetBlank ?? false,
    includeVars: link.includeVars ?? false,
    keepTime: link.keepTime ?? false,
  };
}

interface DashboardSettings {
  title: string;
  description: string;
  tags: string[];
  editable: boolean;
  refresh: string;
  timeRange: { from: string; to: string };
  timezone: string;
  cursorSync: CursorSyncValue;
  links: DashboardLink[];
}

function findCursorSyncBehavior(
  scene: Parameters<MutationCommand['handler']>[1]['scene']
): behaviors.CursorSync | undefined {
  return scene.state.$behaviors?.find((b): b is behaviors.CursorSync => b instanceof behaviors.CursorSync);
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
    cursorSync: cursorSyncToString(findCursorSyncBehavior(scene)?.state.sync),
    links: scene.state.links ?? [],
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

      if (payload.cursorSync !== undefined) {
        const cursorSyncBehavior = findCursorSyncBehavior(scene);
        if (cursorSyncBehavior) {
          cursorSyncBehavior.setState({ sync: CURSOR_SYNC_TO_ENUM[payload.cursorSync] });
        } else {
          warnings.push('cursorSync could not be set: CursorSync behavior not found in scene');
        }
      }

      if (payload.links !== undefined) {
        scene.setState({ links: payload.links.map(normalizeDashboardLink) });
      }

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
