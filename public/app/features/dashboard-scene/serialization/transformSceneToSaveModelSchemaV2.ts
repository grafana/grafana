import { behaviors } from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';

import {
  DashboardV2,
  defaultDashboardSpecV2,
} from '../../../../../packages/grafana-schema/src/schema/dashboard/v2alpha0/dashboard.schema';
import { DashboardScene, DashboardSceneState } from '../scene/DashboardScene';

// FIXME: This is temporary to avoid creating partial types for all the new schema, it has some performance implications, but it's fine for now
type DeepPartial<T> = T extends object
  ? {
    [P in keyof T]?: DeepPartial<T[P]>;
  }
  : T;

export function transformSceneToSaveModelSchemaV2(scene: DashboardScene, isSnapshot = false): Partial<DashboardV2> {
  const oldDash = scene.state;
  const timeRange = oldDash.$timeRange!.state;

  const controlsState = oldDash.controls?.state;
  const refreshPicker = controlsState?.refreshPicker;

  const dashboardSchemaV2: DeepPartial<DashboardV2> = {
    kind: 'Dashboard',
    spec: {
      //dashboard settings
      title: oldDash.title,
      description: oldDash.description ?? '',
      cursorSync: getCursorSync(oldDash),
      liveNow: getLiveNow(oldDash),
      preload: oldDash.preload,
      editable: oldDash.editable,
      links: oldDash.links,
      tags: oldDash.tags,
      // EOF dashboard settings

      // time settings
      timeSettings: {
        timezone: timeRange.timeZone,
        from: timeRange.from,
        to: timeRange.to,
        autoRefresh: refreshPicker?.state.refresh,
        autoRefreshIntervals: refreshPicker?.state.intervals,
        quickRanges: [], //FIXME is coming timepicker.time_options,
        hideTimepicker: controlsState?.hideTimeControls ?? false,
        weekStart: timeRange.weekStart,
        fiscalYearStartMonth: timeRange.fiscalYearStartMonth,
        nowDelay: timeRange.UNSAFE_nowDelay,
      },
      // EOF time settings

      // variables
      variables: [], //FIXME
      // EOF variables

      // elements
      elements: {
        //FIXME
      },
      // EOF elements

      // annotations
      annotations: [], //FIXME
      // EOF annotations

      // layout
      layout: {
        kind: 'GridLayout',
        spec: {
          items: [], //FIXME
        },
      },
      // EOF layout
    },
  };

  if (isDashboardSchemaV2(dashboardSchemaV2)) {
    return dashboardSchemaV2;
  }

  throw new Error('Invalid dashboard schema version 2');
}

function getCursorSync(state: DashboardSceneState) {
  const cursorSync =
    state.$behaviors?.find((b): b is behaviors.CursorSync => b instanceof behaviors.CursorSync)?.state.sync ??
    defaultDashboardSpecV2.cursorSync;
  return cursorSync;
}

function getLiveNow(state: DashboardSceneState) {
  const liveNow =
    state.$behaviors?.find((b): b is behaviors.LiveNowTimer => b instanceof behaviors.LiveNowTimer)?.isEnabled ||
    undefined;
  // hack for validator
  if (liveNow === undefined) {
    return defaultDashboardSpecV2.liveNow;
  }
  return liveNow;
}

// Function to know if the dashboard transformed is a valid DashboardV2
function isDashboardSchemaV2(dashboard: unknown): dashboard is DashboardV2 {
  if (typeof dashboard !== 'object' || dashboard === null) {
    return false;
  }

  const dash = dashboard as any;

  if (dash.kind !== 'Dashboard') {
    return false;
  }
  if (typeof dash.spec !== 'object' || dash.spec === null) {
    return false;
  }

  // Spec-level properties
  if (typeof dash.spec.title !== 'string') {
    return false;
  }
  if (typeof dash.spec.description !== 'string') {
    return false;
  }
  if (typeof dash.spec.cursorSync !== 'number') {
    return false;
  }
  if (!Object.values(DashboardCursorSync).includes(dash.spec.cursorSync)) {
    return false;
  }
  if (typeof dash.spec.liveNow !== 'boolean') {
    return false;
  }
  if (typeof dash.spec.preload !== 'boolean') {
    return false;
  }
  if (typeof dash.spec.editable !== 'boolean') {
    return false;
  }
  if (!Array.isArray(dash.spec.links)) {
    return false;
  }
  if (!Array.isArray(dash.spec.tags)) {
    return false;
  }

  if (dash.spec.id !== undefined && typeof dash.spec.id !== 'number') {
    return false;
  }

  // Time settings
  if (typeof dash.spec.timeSettings !== 'object' || dash.spec.timeSettings === null) {
    return false;
  }
  if (typeof dash.spec.timeSettings.timezone !== 'string') {
    return false;
  }
  if (typeof dash.spec.timeSettings.from !== 'string') {
    return false;
  }
  if (typeof dash.spec.timeSettings.to !== 'string') {
    return false;
  }
  if (typeof dash.spec.timeSettings.autoRefresh !== 'string') {
    return false;
  }
  if (!Array.isArray(dash.spec.timeSettings.autoRefreshIntervals)) {
    return false;
  }
  if (!Array.isArray(dash.spec.timeSettings.quickRanges)) {
    return false;
  }
  if (typeof dash.spec.timeSettings.hideTimepicker !== 'boolean') {
    return false;
  }
  if (typeof dash.spec.timeSettings.weekStart !== 'string') {
    return false;
  }
  if (typeof dash.spec.timeSettings.fiscalYearStartMonth !== 'number') {
    return false;
  }
  if (dash.spec.timeSettings.nowDelay !== undefined && typeof dash.spec.timeSettings.nowDelay !== 'string') {
    return false;
  }

  // Other sections
  if (!Array.isArray(dash.spec.variables)) {
    return false;
  }
  if (typeof dash.spec.elements !== 'object' || dash.spec.elements === null) {
    return false;
  }
  if (!Array.isArray(dash.spec.annotations)) {
    return false;
  }

  // Layout
  if (typeof dash.spec.layout !== 'object' || dash.spec.layout === null) {
    return false;
  }
  if (dash.spec.layout.kind !== 'GridLayout') {
    return false;
  }
  if (typeof dash.spec.layout.spec !== 'object' || dash.spec.layout.spec === null) {
    return false;
  }
  if (!Array.isArray(dash.spec.layout.spec.items)) {
    return false;
  }

  return true;
}
