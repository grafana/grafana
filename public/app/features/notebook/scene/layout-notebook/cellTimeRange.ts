import {
  SceneObjectBase,
  SceneTimePicker,
  SceneTimeRange,
  type SceneObjectState,
  type SceneObjectUrlSyncHandler,
} from '@grafana/scenes';

import { type NotebookCellTimeRangeSpec } from '../../types';

/**
 * A raw SceneTimeRange always wires up browser-URL sync unconditionally, which is right for the
 * notebook's own document-level range but wrong for a per-cell override — it would collide with the
 * document range for the same URL keys once active, and the URL would win over the saved value on
 * reload. PanelTimeRange (the dashboard's own per-panel override) avoids this the same way, by not
 * extending SceneTimeRange at all; this instead overrides the inherited `urlSync` getter.
 */
class NotebookCellTimeRange extends SceneTimeRange {
  // Typed to match the inherited getter, not narrowed to `undefined` alone — narrowing it breaks
  // structural compatibility with SceneTimeRange.
  public get urlSync(): SceneObjectUrlSyncHandler | undefined {
    return undefined;
  }
}

/**
 * spec → scene. Deliberately not `buildSceneTimeRange` (dashboard-scene/serialization/shared/
 * timeSettings) — that builder's signature requires the full `TimeSettingsSpec` shape
 * (fiscalYearStartMonth, weekStart, nowDelay…), none of which a per-cell override carries.
 */
export function buildCellSceneTimeRange(spec: NotebookCellTimeRangeSpec): SceneTimeRange {
  return new NotebookCellTimeRange({ from: spec.from, to: spec.to, timeZone: spec.timezone });
}

/** scene → spec. */
export function buildCellTimeRangeSpec(timeRange: SceneTimeRange): NotebookCellTimeRangeSpec {
  const { from, to, timeZone } = timeRange.state;
  return { from, to, ...(timeZone ? { timezone: timeZone } : {}) };
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
