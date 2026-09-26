import { getDefaultTimeRange, rangeUtil, setWeekStart, type TimeOption, type TimeRange } from '@grafana/data';
import {
  SceneObjectBase,
  SceneTimePicker,
  SceneTimeRange,
  SceneTimeRangeTransformerBase,
  type SceneObjectState,
  type SceneObjectUrlSyncHandler,
  type SceneTimeRangeLike,
  type SceneTimeRangeState,
} from '@grafana/scenes';

import { type PanelKind } from '../../types';

class NotebookCellTimeRange extends SceneTimeRangeTransformerBase<SceneTimeRangeState> implements SceneTimeRangeLike {
  public constructor(state: { from: string; to: string }) {
    // Not valid until activation, same as PanelTimeRange — refreshValue() needs a real ancestor.
    super({ ...state, value: getDefaultTimeRange() });
    this.addActivationHandler(() => this.refreshValue());
  }

  protected ancestorTimeRangeChanged(): void {
    this.refreshValue();
  }

  public onTimeRangeChange(timeRange: TimeRange): void {
    this.setState({
      from: typeof timeRange.raw.from === 'string' ? timeRange.raw.from : timeRange.raw.from.toISOString(),
      to: typeof timeRange.raw.to === 'string' ? timeRange.raw.to : timeRange.raw.to.toISOString(),
      value: timeRange,
    });
  }

  private refreshValue(): void {
    const ancestor = this.getAncestorTimeRange().state;
    // convertRawToRange reads week start from the global date locale, same as SceneTimeRange.
    if (ancestor.weekStart) {
      setWeekStart(ancestor.weekStart);
    }
    const value = rangeUtil.convertRawToRange(
      { from: this.state.from, to: this.state.to },
      this.getTimeZone(),
      ancestor.fiscalYearStartMonth
    );
    this.setState({ value });
  }
}

export function buildCellSceneTimeRange(from: string, to: string): SceneTimeRangeLike {
  return new NotebookCellTimeRange({ from, to });
}

export interface CellTimeRangeSpec {
  from: string;
  to: string;
}

export function buildCellTimeRangeSpec(timeRange: SceneTimeRangeLike): CellTimeRangeSpec {
  const { from, to } = timeRange.state;
  return { from, to };
}

/**
 * Only for the popover's own draft: a scratch SceneTimeRange detached from the notebook's scene
 * tree, so it has no real ancestor to delegate timezone to — unlike the committed
 * NotebookCellTimeRange above, it needs its own explicit, one-time-snapshotted zone.
 */
class DraftCellTimeRange extends SceneTimeRange {
  public get urlSync(): SceneObjectUrlSyncHandler | undefined {
    return undefined;
  }
}

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
  // Rendered directly via timePicker.Component: resolves sceneGraph.getTimeRange(timePicker) to
  // $timeRange above, since SceneObjectBase auto-parents timePicker under this host.
  timePicker: SceneTimePicker;
}

/**
 * A scene-graph fragment used only inside the time-range popover, never attached to the notebook's
 * own tree
 */
export class DraftTimeRangeHost extends SceneObjectBase<DraftTimeRangeHostState> {}

export function buildDraftTimeRangeHost(
  from: string,
  to: string,
  timeZone: string,
  weekStart: SceneTimeRangeState['weekStart'],
  quickRanges?: TimeOption[]
): DraftTimeRangeHost {
  return new DraftTimeRangeHost({
    $timeRange: new DraftCellTimeRange({ from, to, timeZone, weekStart }),
    timePicker: new SceneTimePicker({ quickRanges }),
  });
}
