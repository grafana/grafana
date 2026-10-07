import { behaviors, sceneGraph } from '@grafana/scenes';

import {
  type DashboardCursorSync,
  type DashboardLink,
  type TimeSettingsSpec,
} from '../../../../../../packages/grafana-schema/src/schema/dashboard/v2';
import { transformCursorSynctoEnum } from '../../serialization/transformToV2TypesUtils';

import type { MutationContext } from './types';

export interface DashboardSettings {
  title: string;
  description: string;
  tags: string[];
  editable: boolean;
  cursorSync: DashboardCursorSync;
  links: DashboardLink[];
  timeSettings: Partial<TimeSettingsSpec>;
  liveNow: boolean;
  preload: boolean;
}

export function findCursorSyncBehavior(scene: MutationContext['scene']): behaviors.CursorSync | undefined {
  return scene.state.$behaviors?.find((b): b is behaviors.CursorSync => b instanceof behaviors.CursorSync);
}

export function findLiveNowBehavior(scene: MutationContext['scene']): behaviors.LiveNowTimer | undefined {
  return scene.state.$behaviors?.find((b): b is behaviors.LiveNowTimer => b instanceof behaviors.LiveNowTimer);
}

export function readDashboardSettings(scene: MutationContext['scene']): DashboardSettings {
  const timeRange = sceneGraph.getTimeRange(scene);
  const refreshPicker = scene.state.controls?.state.refreshPicker;

  return {
    title: scene.state.title ?? '',
    description: scene.state.description ?? '',
    tags: scene.state.tags ?? [],
    editable: scene.state.editable ?? true,
    cursorSync: transformCursorSynctoEnum(findCursorSyncBehavior(scene)?.state.sync),
    links: scene.state.links ?? [],
    timeSettings: {
      from: timeRange.state.from,
      to: timeRange.state.to,
      timezone: timeRange.state.timeZone ?? '',
      autoRefresh: refreshPicker?.state.refresh ?? '',
    },
    liveNow: findLiveNowBehavior(scene)?.isEnabled ?? false,
    preload: scene.state.preload ?? false,
  };
}
