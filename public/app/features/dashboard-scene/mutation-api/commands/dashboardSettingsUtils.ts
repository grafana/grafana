/**
 * Shared helpers for reading dashboard-level settings off the DashboardScene.
 *
 * Used by UPDATE_DASHBOARD_SETTINGS (to diff before/after) and GET_DASHBOARD_INFO
 * (to report current values), so the set of settings stays in sync between the
 * command that writes them and the command that reads them.
 */

import { behaviors, sceneGraph } from '@grafana/scenes';

import {
  type DashboardCursorSync,
  type DashboardLink,
} from '../../../../../../packages/grafana-schema/src/schema/dashboard/v2';
import { transformCursorSynctoEnum } from '../../serialization/transformToV2TypesUtils';

import type { MutationContext } from './types';

export interface DashboardSettings {
  title: string;
  description: string;
  tags: string[];
  editable: boolean;
  refresh: string;
  timeRange: { from: string; to: string };
  timezone: string;
  cursorSync: DashboardCursorSync;
  links: DashboardLink[];
}

export function findCursorSyncBehavior(scene: MutationContext['scene']): behaviors.CursorSync | undefined {
  return scene.state.$behaviors?.find((b): b is behaviors.CursorSync => b instanceof behaviors.CursorSync);
}

export function readDashboardSettings(scene: MutationContext['scene']): DashboardSettings {
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
