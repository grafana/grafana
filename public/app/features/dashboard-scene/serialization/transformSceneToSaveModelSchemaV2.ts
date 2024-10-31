import { behaviors, VizPanel } from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';
import { GridLayoutItemKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/kinds';

import {
  DashboardV2,
  defaultDashboardSpecV2,
} from '../../../../../packages/grafana-schema/src/schema/dashboard/v2alpha0/dashboard.schema';
import { DashboardGridItem } from '../scene/DashboardGridItem';
import { DashboardScene, DashboardSceneState } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

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
          items: getGridLayoutItems(oldDash),
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

function getGridLayoutItems(state: DashboardSceneState, isSnapshot?: boolean): GridLayoutItemKind[] {
  const body = state.body;
  const elements: GridLayoutItemKind[] = [];
  if (body instanceof DefaultGridLayoutManager) {
    for (const child of body.state.grid.state.children) {
      if (child instanceof DashboardGridItem) {
        // TODO: handle panel repeater scenario
        // if (child.state.variableName) {
        //   panels = panels.concat(panelRepeaterToPanels(child, isSnapshot));
        // } else {
        elements.push(gridItemToGridLayoutItemKind(child, isSnapshot));
        // }
      }

      // TODO: OLD transformer code
      // if (child instanceof SceneGridRow) {
      //   // Skip repeat clones or when generating a snapshot
      //   if (child.state.key!.indexOf('-clone-') > 0 && !isSnapshot) {
      //     continue;
      //   }
      //   gridRowToSaveModel(child, panels, isSnapshot);
      // }
    }
  }
  return elements;
}

export function gridItemToGridLayoutItemKind(gridItem: DashboardGridItem, isSnapshot = false): GridLayoutItemKind {
  let elementGridItem: GridLayoutItemKind | undefined;
  let x = 0,
    y = 0,
    width = 0,
    height = 0;

  let gridItem_ = gridItem;

  if (!(gridItem_.state.body instanceof VizPanel)) {
    throw new Error('DashboardGridItem body expected to be VizPanel');
  }

  // Get the grid position and size
  height = (gridItem_.state.variableName ? gridItem_.state.itemHeight : gridItem_.state.height) ?? 0;
  x = gridItem_.state.x ?? 0;
  y = gridItem_.state.y ?? 0;
  width = gridItem_.state.width ?? 0;

  // FIXME: which name should we use for the element reference, key or something else ?
  const elementName = gridItem_.state.body.state.key ?? 'DefaultName';
  elementGridItem = {
    kind: 'GridLayoutItem',
    spec: {
      x,
      y,
      width: width,
      height: height,
      element: {
        kind: 'ElementReference',
        spec: {
          name: elementName,
        },
      },
    },
  };

  if (!elementGridItem) {
    throw new Error('Unsupported grid item type');
  }

  return elementGridItem;
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
