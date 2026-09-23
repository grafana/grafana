import {
  SceneObjectBase,
  SceneTimePicker,
  SceneTimeRange,
  type SceneObjectState,
  type SceneObjectUrlSyncHandler,
} from '@grafana/scenes';

import { type NotebookCellTimeRangeSpec } from '../../types';

class NotebookCellTimeRange extends SceneTimeRange {
  public get urlSync(): SceneObjectUrlSyncHandler | undefined {
    return undefined;
  }
}

/**
 * spec → scene. Deliberately not `buildSceneTimeRange` (dashboard-scene/serialization/shared/
 * timeSettings) — that builder's signature requires the full `TimeSettingsSpec` shape
 * (autoRefresh, quickRanges, hideTimepicker…), most of which a per-cell override has no use for.
 */
export function buildCellSceneTimeRange(spec: NotebookCellTimeRangeSpec): SceneTimeRange {
  return new NotebookCellTimeRange({
    from: spec.from,
    to: spec.to,
    timeZone: spec.timezone,
    fiscalYearStartMonth: spec.fiscalYearStartMonth,
  });
}

/** scene → spec. */
export function buildCellTimeRangeSpec(timeRange: SceneTimeRange): NotebookCellTimeRangeSpec {
  const { from, to, timeZone, fiscalYearStartMonth } = timeRange.state;
  return {
    from,
    to,
    ...(timeZone ? { timezone: timeZone } : {}),
    ...(fiscalYearStartMonth !== undefined ? { fiscalYearStartMonth } : {}),
  };
}

interface DraftTimeRangeHostState extends SceneObjectState {
  $timeRange: SceneTimeRange;
  timePicker: SceneTimePicker;
}

/**
 * A scene-graph fragment used only inside the time-range popover, never attached to the notebook's
 * own tree — lets the popover edit a draft via the real TimeRangePicker UI without touching the
 * cell's own `$timeRange` until Apply.
 */
export class DraftTimeRangeHost extends SceneObjectBase<DraftTimeRangeHostState> {}

export function buildDraftTimeRangeHost(spec: NotebookCellTimeRangeSpec): DraftTimeRangeHost {
  return new DraftTimeRangeHost({ $timeRange: buildCellSceneTimeRange(spec), timePicker: new SceneTimePicker({}) });
}
