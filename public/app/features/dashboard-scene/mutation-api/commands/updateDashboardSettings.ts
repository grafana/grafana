import { type z } from 'zod';

import { textUtil } from '@grafana/data';
import { behaviors, sceneGraph } from '@grafana/scenes';

import {
  type DashboardLink,
  defaultDashboardLink,
} from '../../../../../../packages/grafana-schema/src/schema/dashboard/v2';
import { transformCursorSyncV2ToV1 } from '../../serialization/transformToV1TypesUtils';
import { transformCursorSynctoEnum } from '../../serialization/transformToV2TypesUtils';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';

const updateDashboardSettingsPayloadSchema = payloads.updateDashboardSettings;

export type UpdateDashboardSettingsPayload = z.infer<typeof updateDashboardSettingsPayloadSchema>;

type CursorSyncValue = NonNullable<UpdateDashboardSettingsPayload['cursorSync']>;
type DashboardLinkPayload = NonNullable<UpdateDashboardSettingsPayload['links']>[number];

// URLs are sanitized because links render as clickable and the input is
// model-controlled (could carry a javascript:/data: scheme).
function normalizeDashboardLink(link: DashboardLinkPayload): DashboardLink {
  const defaults = defaultDashboardLink();
  return {
    title: link.title ?? defaults.title,
    url: link.url ? textUtil.sanitizeUrl(link.url) : defaults.url,
    type: link.type ?? defaults.type,
    icon: link.icon ?? defaults.icon,
    tooltip: link.tooltip ?? defaults.tooltip,
    tags: link.tags ?? defaults.tags,
    asDropdown: link.asDropdown ?? defaults.asDropdown,
    targetBlank: link.targetBlank ?? defaults.targetBlank,
    includeVars: link.includeVars ?? defaults.includeVars,
    keepTime: link.keepTime ?? defaults.keepTime,
    ...(link.placement !== undefined && { placement: link.placement }),
  };
}

export interface DashboardSettings {
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

export function readDashboardSettings(scene: Parameters<MutationCommand['handler']>[1]['scene']): DashboardSettings {
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
    cursorSync: transformCursorSynctoEnum(findCursorSyncBehavior(scene)?.state.sync),
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
      const previousValue = readDashboardSettings(scene);
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
          cursorSyncBehavior.setState({ sync: transformCursorSyncV2ToV1(payload.cursorSync) });
        } else {
          warnings.push('cursorSync could not be set: CursorSync behavior not found in scene');
        }
      }

      if (payload.links !== undefined) {
        scene.setState({ links: payload.links.map(normalizeDashboardLink) });
      }

      const newValue = readDashboardSettings(scene);

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
