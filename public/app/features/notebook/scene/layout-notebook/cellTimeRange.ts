import {
  SceneObjectBase,
  SceneTimePicker,
  SceneTimeRange,
  type SceneObjectState,
  type SceneObjectUrlSyncHandler,
} from '@grafana/scenes';

import { type PanelKind } from '../../types';

/**
 * A raw SceneTimeRange always wires up browser-URL sync unconditionally, which is right for the
 * notebook's own document-level range but wrong for a per-cell override — it would collide with
 * the document range for the same URL keys. This overrides the inherited `urlSync` getter to
 * disable it.
 */
class NotebookCellTimeRange extends SceneTimeRange {
  // Typed to match the inherited getter, not narrowed to `undefined` alone — narrowing it breaks
  // structural compatibility with SceneTimeRange.
  public get urlSync(): SceneObjectUrlSyncHandler | undefined {
    return undefined;
  }
}

/**
 * `timeZone` is a one-time snapshot, passed only when building the popover's *draft* (see
 * `buildDraftTimeRangeHost`) — the draft host is detached from the real scene tree, so its own
 * ancestor-timezone lookup can't reach the notebook. The committed cell's own time range is built
 * without it, so `getTimeZone()`'s built-in ancestor walk resolves the notebook's timezone live.
 */
export function buildCellSceneTimeRange(from: string, to: string, timeZone?: string): SceneTimeRange {
  return new NotebookCellTimeRange({ from, to, timeZone });
}

/** Not CUE-backed: the persisted shape is just QueryOptionsSpec.timeFrom/.timeTo (two plain
 * strings), so this is purely an internal convenience pairing, not a validated schema type. */
export interface CellTimeRangeSpec {
  from: string;
  to: string;
}

export function buildCellTimeRangeSpec(timeRange: SceneTimeRange): CellTimeRangeSpec {
  const { from, to } = timeRange.state;
  return { from, to };
}

/**
 * Sets or clears a panel element's own time window, on the same `QueryOptionsSpec.timeFrom`/
 * `.timeTo` leaf the dashboard's own "Panel time options" uses for its unrelated timeFrom/
 * timeShift pairing. A notebook panel never sets timeShift/timeCompare, so there's no collision —
 * see deserializeNotebookLayout.ts for why timeFrom/timeTo have to be stripped before
 * buildVizPanelState runs, rather than left for it to interpret.
 */
export function withQueryOptionsTimeRange(element: PanelKind, range: CellTimeRangeSpec | undefined): PanelKind {
  return {
    ...element,
    spec: {
      ...element.spec,
      data: {
        ...element.spec.data,
        spec: {
          ...element.spec.data.spec,
          queryOptions: {
            ...element.spec.data.spec.queryOptions,
            timeFrom: range?.from,
            timeTo: range?.to,
          },
        },
      },
    },
  };
}

interface DraftTimeRangeHostState extends SceneObjectState {
  $timeRange: SceneTimeRange;
  // Not rendered — only its onMoveBackward/onMoveForward/onZoom methods are called directly, which
  // need a scene-graph parent to resolve sceneGraph.getTimeRange(this) to $timeRange above.
  timePicker: SceneTimePicker;
}

/**
 * A scene-graph fragment used only inside the time-range popover, never attached to the notebook's
 * own tree — lets the popover edit a draft via the real TimeRangePicker UI without touching the
 * cell's own `$timeRange` until Apply.
 */
export class DraftTimeRangeHost extends SceneObjectBase<DraftTimeRangeHostState> {}

export function buildDraftTimeRangeHost(from: string, to: string, timeZone: string): DraftTimeRangeHost {
  return new DraftTimeRangeHost({
    $timeRange: buildCellSceneTimeRange(from, to, timeZone),
    timePicker: new SceneTimePicker({}),
  });
}
